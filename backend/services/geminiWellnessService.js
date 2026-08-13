import { env } from "../config/env.js";

const GEMINI_TIMEOUT_MS = 12000;
const MAX_HIGHLIGHTS = 5;

/**
 * Builds a strict anonymous whitelist for Gemini.
 * @param {object[]} reports - Recent submitted wellness reports.
 * @returns {object[]} Anonymous wellness values without IDs or identifying text.
 * @sideEffects None.
 */
export function sanitizeReportsForGemini(reports) {
  const sanitizedReports = [];

  for (let index = 0; index < reports.length; index += 1) {
    const report = reports[index];
    const vitals = report.vitals || {};

    sanitizedReports.push({
      sequence: index + 1,
      date: new Date(report.visitDate).toISOString().slice(0, 10),
      mood: report.mood || null,
      mealStatus: report.mealStatus || null,
      medicineIntakeStatus: report.medicineIntakeStatus || null,
      bloodPressure: {
        systolic: Number.isFinite(vitals.systolic)
          ? vitals.systolic
          : null,
        diastolic: Number.isFinite(vitals.diastolic)
          ? vitals.diastolic
          : null,
        unit: "mmHg",
      },
      bloodSugar: {
        value: Number.isFinite(vitals.bloodSugar)
          ? vitals.bloodSugar
          : null,
        unit: "mg/dL",
        context: vitals.bloodSugarContext || "unknown",
      },
      weight: {
        value: Number.isFinite(vitals.weightKg)
          ? vitals.weightKg
          : null,
        unit: "kg",
      },
      exerciseDurationMinutes:
        Number.isFinite(report.exerciseDurationMinutes)
          ? report.exerciseDurationMinutes
          : null,
    });
  }

  return sanitizedReports;
}

/**
 * Validates Gemini's parsed structured response.
 * @param {unknown} value - Untrusted parsed provider output.
 * @returns {{summary: string, highlights: string[], recommendedFollowUp: string}|null} Safe summary or null.
 * @sideEffects None.
 */
function validateGeminiOutput(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (
    typeof value.summary !== "string" ||
    typeof value.recommendedFollowUp !== "string" ||
    !Array.isArray(value.highlights)
  ) {
    return null;
  }

  const summary = value.summary.trim().slice(0, 1200);
  const recommendedFollowUp = value.recommendedFollowUp
    .trim()
    .slice(0, 600);
  const highlights = [];

  for (const item of value.highlights.slice(0, MAX_HIGHLIGHTS)) {
    if (typeof item === "string" && item.trim()) {
      highlights.push(item.trim().slice(0, 300));
    }
  }

  if (!summary || !recommendedFollowUp) {
    return null;
  }

  return {
    summary,
    highlights,
    recommendedFollowUp,
  };
}

/**
 * Requests a short non-diagnostic structured summary from Gemini.
 * @param {object[]} reports - Recent submitted wellness reports.
 * @param {{apiKey?: string, fetchFunction?: Function}} [options] - Optional test overrides.
 * @returns {Promise<{summary: string, highlights: string[], recommendedFollowUp: string}|null>} Validated result or null when unavailable.
 * @sideEffects Sends only whitelisted anonymous values to the Gemini API.
 */
export async function generateGeminiWellnessSummary(reports, options = {}) {
  const apiKey =
    options.apiKey === undefined
      ? env.geminiApiKey
      : options.apiKey;
  const fetchFunction = options.fetchFunction || fetch;

  if (!apiKey) {
    return null;
  }

  const anonymousReports = sanitizeReportsForGemini(reports);
  const prompt = [
    "Summarize only the anonymous wellness data provided below.",
    "Do not diagnose, name diseases, claim certainty, or assign alert severity.",
    "Use short family-friendly language.",
    "Mention that the information is limited and non-diagnostic.",
    "Recommend professional follow-up only in general terms when appropriate.",
    "Return only the requested JSON structure.",
    JSON.stringify({ reports: anonymousReports }),
  ].join("\n");

  const responseSchema = {
    type: "OBJECT",
    properties: {
      summary: {
        type: "STRING",
      },
      highlights: {
        type: "ARRAY",
        items: {
          type: "STRING",
        },
      },
      recommendedFollowUp: {
        type: "STRING",
      },
    },
    required: [
      "summary",
      "highlights",
      "recommendedFollowUp",
    ],
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, GEMINI_TIMEOUT_MS);

  try {
    const model = encodeURIComponent(env.geminiModel);
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      model +
      ":generateContent";
    const response = await fetchFunction(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [{
            text: prompt,
          }],
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 450,
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof text !== "string") {
      return null;
    }

    const parsed = JSON.parse(text);
    return validateGeminiOutput(parsed);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}
