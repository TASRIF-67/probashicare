import assert from "node:assert/strict";
import test from "node:test";
import {
  generateGeminiWellnessSummary,
  sanitizeReportsForGemini,
} from "../services/geminiWellnessService.js";
import { buildFallbackWellnessSummary } from "../services/wellnessInsightService.js";
import { analyzeWellnessReportValues } from "../services/wellnessAnalysisService.js";

/**
 * Creates a synthetic wellness report for unit tests.
 * @param {object} overrides - Fields to replace.
 * @returns {object} Synthetic report without database access.
 * @sideEffects None.
 */
function report(overrides = {}) {
  return {
    _id: overrides._id || "report-id",
    status: overrides.status || "submitted",
    visitDate: overrides.visitDate || new Date("2026-08-01"),
    mood: overrides.mood || "good",
    mealStatus: overrides.mealStatus || "full",
    medicineIntakeStatus: overrides.medicineIntakeStatus || "all-taken",
    exerciseDurationMinutes: 20,
    vitals: overrides.vitals || {},
    elderlyName: "Private Elder",
    caregiverNotes: "Private unrestricted note",
  };
}

test("Gemini sanitizer returns only whitelisted anonymous values", () => {
  const sanitized = sanitizeReportsForGemini([
    report({
      _id: "secret-database-id",
      vitals: {
        systolic: 145,
        diastolic: 92,
        bloodSugar: 181,
        weightKg: 70,
      },
    }),
  ]);
  const serialized = JSON.stringify(sanitized);

  assert.equal(serialized.includes("secret-database-id"), false);
  assert.equal(serialized.includes("Private Elder"), false);
  assert.equal(serialized.includes("Private unrestricted note"), false);
  assert.equal(sanitized[0].bloodSugar.unit, "mg/dL");
  assert.equal(sanitized[0].bloodPressure.unit, "mmHg");
});

test("draft reports do not contribute to deterministic alerts", () => {
  const reports = [
    report({ status: "draft", vitals: { systolic: 160, diastolic: 100 } }),
    report({ status: "draft", vitals: { systolic: 165, diastolic: 102 } }),
  ];

  assert.deepEqual(analyzeWellnessReportValues(reports), []);
});

test("repeated submitted elevated readings trigger deterministic alerts", () => {
  const reports = [
    report({ _id: "one", vitals: { systolic: 150, diastolic: 95, bloodSugar: 190 } }),
    report({ _id: "two", vitals: { systolic: 148, diastolic: 93, bloodSugar: 185 } }),
  ];
  const results = analyzeWellnessReportValues(reports);
  const ruleIds = results.map((result) => result.ruleId);

  assert.equal(ruleIds.includes("repeated-high-blood-pressure"), true);
  assert.equal(ruleIds.includes("repeated-elevated-blood-sugar"), true);
});

test("fallback summary remains useful without Gemini", () => {
  const summary = buildFallbackWellnessSummary({
    reports: [report()],
    ruleResults: [],
  });

  assert.equal(summary.summary.includes("not a diagnosis"), true);
  assert.equal(summary.highlights.length, 1);
  assert.equal(typeof summary.recommendedFollowUp, "string");
});

test("missing Gemini key returns null without making a request", async () => {
  let requestMade = false;
  const result = await generateGeminiWellnessSummary(
    [report()],
    {
      apiKey: "",
      fetchFunction: async () => {
        requestMade = true;
      },
    },
  );

  assert.equal(result, null);
  assert.equal(requestMade, false);
});

test("malformed Gemini output returns null for fallback handling", async () => {
  const result = await generateGeminiWellnessSummary(
    [report()],
    {
      apiKey: "synthetic-test-key",
      fetchFunction: async () => {
        return {
          ok: true,
          json: async () => {
            return {
              candidates: [{
                content: {
                  parts: [{
                    text: "not-json",
                  }],
                },
              }],
            };
          },
        };
      },
    },
  );

  assert.equal(result, null);
});
