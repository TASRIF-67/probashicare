import { env } from "../config/env.js";

const GEMINI_TIMEOUT_MS = 12000;
const MAX_HIGHLIGHTS = 5;

/**
 * Returns a number only when it is finite.
 * @param {unknown} value - Value read from a wellness report.
 * @returns {number|null} Original finite number or null.
 * @sideEffects None.
 */
function getFiniteNumberOrNull(value) {
  // Number.isFinite checks the value without converting strings into numbers.
  if (Number.isFinite(value)) {
    return value;
  }

  return null;
}

/**
 * Builds a strict anonymous whitelist for Gemini.
 * @param {object[]} reports - Recent submitted wellness reports.
 * @returns {object[]} Anonymous wellness values without IDs or identifying text.
 * @sideEffects None.
 */
export function sanitizeReportsForGemini(reports) {
  const sanitizedReports = [];

  // This indexed loop provides a harmless sequence without sending database
  // IDs. reports.length is the number of array items.
  for (let index = 0; index < reports.length; index += 1) {
    const report = reports[index];
    const vitals = report.vitals || {};

    // new Date converts the stored value to a Date. toISOString creates UTC
    // text. slice(0, 10) keeps only YYYY-MM-DD.
    const visitDate = new Date(report.visitDate);
    const visitDateText = visitDate.toISOString().slice(0, 10);

    const anonymousReport = {
      sequence: index + 1,
      date: visitDateText,
      mood: report.mood || null,
      mealStatus: report.mealStatus || null,
      medicineIntakeStatus: report.medicineIntakeStatus || null,
      bloodPressure: {
        systolic: getFiniteNumberOrNull(vitals.systolic),
        diastolic: getFiniteNumberOrNull(vitals.diastolic),
        unit: "mmHg",
      },
      bloodSugar: {
        value: getFiniteNumberOrNull(vitals.bloodSugar),
        unit: "mg/dL",
        context: vitals.bloodSugarContext || "unknown",
      },
      weight: {
        value: getFiniteNumberOrNull(vitals.weightKg),
        unit: "kg",
      },
      exerciseDurationMinutes: getFiniteNumberOrNull(
        report.exerciseDurationMinutes,
      ),
    };

    // push adds one object to the end of the result array.
    sanitizedReports.push(anonymousReport);
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

  const hasSummary = typeof value.summary === "string";
  const hasFollowUp = typeof value.recommendedFollowUp === "string";
  // Array.isArray verifies that highlights is a real array.
  const hasHighlights = Array.isArray(value.highlights);

  if (!hasSummary || !hasFollowUp || !hasHighlights) {
    return null;
  }

  // trim removes outside whitespace. slice restricts text to the same maximum
  // lengths enforced by the Mongoose schema.
  const summary = value.summary.trim().slice(0, 1200);
  const recommendedFollowUp = value.recommendedFollowUp.trim().slice(0, 600);
  const highlights = [];

  // Math.min returns the smaller number, so only the provider's first five
  // array positions are considered, exactly as before this refactor.
  const highlightLimit = Math.min(value.highlights.length, MAX_HIGHLIGHTS);

  for (let index = 0; index < highlightLimit; index += 1) {
    const item = value.highlights[index];

    if (typeof item === "string" && item.trim()) {
      const cleanItem = item.trim().slice(0, 300);
      highlights.push(cleanItem);
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
 * @returns {Promise<object|null>} Validated summary fields or null when unavailable.
 * @sideEffects Sends only whitelisted anonymous values to the Gemini API.
 */
export async function generateGeminiWellnessSummary(reports, options = {}) {
  // Execution sequence:
  // 1. Resolve configuration and sanitize reports to an anonymous whitelist.
  // 2. Build the constrained prompt/schema and call Gemini with a timeout.
  // 3. Parse and validate provider JSON as untrusted input.
  // 4. Return null on failure so deterministic fallback can run.
  let apiKey = env.geminiApiKey;

  // Tests can intentionally supply an API key, including an empty string.
  if (options.apiKey !== undefined) {
    apiKey = options.apiKey;
  }

  let fetchFunction = fetch;

  // Tests can replace the global fetch function with a controlled fake.
  if (options.fetchFunction) {
    fetchFunction = options.fetchFunction;
  }

  if (!apiKey) {
    return null;
  }

  const anonymousReports = sanitizeReportsForGemini(reports);

  // JSON.stringify converts the anonymous array into JSON text for the prompt.
  // join combines the instruction lines using one newline between each item.
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
    required: ["summary", "highlights", "recommendedFollowUp"],
  };

  // AbortController creates a signal that can cancel fetch after the timeout.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, GEMINI_TIMEOUT_MS);

  try {
    // encodeURIComponent safely places the configured model name in one URL segment.
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
      // JSON.stringify converts the request object into the JSON text sent over HTTP.
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
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

    // response.json returns a Promise that resolves after the response body is
    // parsed from JSON text into JavaScript objects and arrays.
    const payload = await response.json();
    let generatedText = null;

    // Gemini returns candidates as an array. These explicit checks prevent a
    // missing provider field from causing a property-access error.
    if (payload && Array.isArray(payload.candidates)) {
      const firstCandidate = payload.candidates[0];
      const content = firstCandidate && firstCandidate.content;
      const parts = content && content.parts;

      if (Array.isArray(parts) && parts[0]) {
        generatedText = parts[0].text;
      }
    }

    if (typeof generatedText !== "string") {
      return null;
    }

    // JSON.parse converts provider JSON text to an object. It can throw, so it
    // remains inside try and causes the normal null/fallback path on failure.
    const parsedOutput = JSON.parse(generatedText);
    const validatedOutput = validateGeminiOutput(parsedOutput);

    return validatedOutput;
  } catch (error) {
    // Network, timeout, and JSON errors all return null so the caller can use
    // the local fallback. The provider error is not exposed to family users.
    return null;
  } finally {
    // clearTimeout prevents the timer callback from running after completion.
    clearTimeout(timeoutId);
  }
}
