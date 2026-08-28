import { WellnessInsight } from "../models/WellnessInsight.js";
import { analyzeRecentWellnessReports } from "./wellnessAnalysisService.js";
import { generateGeminiWellnessSummary } from "./geminiWellnessService.js";

const REGENERATION_COOLDOWN_MS = 10 * 60 * 1000;

/**
 * Builds a stable signature for the current submitted-report set.
 * @param {object[]} reports - Recent reports.
 * @returns {string} Comma-separated report identity signature.
 * @sideEffects None.
 */
function buildReportSignature(reports) {
  const reportIds = [];

  for (const report of reports) {
    reportIds.push(report._id.toString());
  }

  // sort changes the ID array into a stable order. join combines the IDs into
  // one string, so a different report order cannot change the signature.
  reportIds.sort();
  const signature = reportIds.join(",");

  return signature;
}

/**
 * Creates a readable non-diagnostic summary without an external provider.
 * @param {{reports: object[], ruleResults: object[]}} analysis - Deterministic analysis.
 * @returns {{summary: string, highlights: string[], recommendedFollowUp: string}} Fallback summary.
 * @sideEffects None.
 */
export function buildFallbackWellnessSummary(analysis) {
  const reportCount = analysis.reports.length;
  const highlights = [];

  for (const rule of analysis.ruleResults) {
    highlights.push(rule.title);
  }

  if (highlights.length === 0) {
    highlights.push(
      "No demonstration alert rule was triggered in this period.",
    );
  }

  let reportWord = "reports";

  if (reportCount === 1) {
    reportWord = "report";
  }

  const summary =
    "This summary covers " +
    reportCount +
    " recent submitted wellness " +
    reportWord +
    ". It describes recorded patterns only and is not a diagnosis.";
  let recommendedFollowUp =
    "Continue reviewing regular wellness reports and recorded changes.";

  if (analysis.ruleResults.length > 0) {
    recommendedFollowUp =
      "Consider discussing repeated or concerning recorded changes with a qualified healthcare professional.";
  }

  return {
    summary,
    // slice returns a new array containing at most the first five items.
    highlights: highlights.slice(0, 5),
    recommendedFollowUp,
  };
}

/**
 * Returns the newest saved insight for an elderly profile.
 * @param {string|import("mongoose").Types.ObjectId} elderlyProfileId - Elderly profile ID.
 * @returns {Promise<object|null>} Latest saved insight or null.
 * @sideEffects Reads WellnessInsight documents.
 */
export async function getLatestWellnessInsight(elderlyProfileId) {
  // findOne returns one matching document or null. sort with -1 asks for the
  // newest generatedAt first. lean returns a plain object instead of a full
  // Mongoose document because this function does not need save().
  const insight = await WellnessInsight.findOne({
    elderlyProfileId,
  })
    .sort({
      generatedAt: -1,
    })
    .lean();

  return insight;
}

/**
 * Generates or reuses a recent insight for unchanged submitted reports.
 * @param {string|import("mongoose").Types.ObjectId} elderlyProfileId - Elderly profile ID.
 * @returns {Promise<{insight: object, reused: boolean}>} Saved insight and cache indicator.
 * @sideEffects Reads reports, may call Gemini, and may create WellnessInsight.
 */
export async function generateWellnessInsight(elderlyProfileId) {
  const analysis = await analyzeRecentWellnessReports(elderlyProfileId);

  if (analysis.reports.length === 0) {
    return {
      insight: null,
      reused: false,
    };
  }

  const reportSignature = buildReportSignature(analysis.reports);

  // Date.now returns the current time as milliseconds. Subtracting the
  // cooldown creates the oldest generatedAt time that may still be reused.
  const currentTime = Date.now();
  const cooldownTime = currentTime - REGENERATION_COOLDOWN_MS;
  const cooldownStart = new Date(cooldownTime);
  const cacheFilter = {
    elderlyProfileId,
    reportSignature,
    generatedBy: "gemini",
    generatedAt: {
      // $gte means generatedAt must be greater than or equal to this Date.
      $gte: cooldownStart,
    },
  };

  // This cache deliberately reuses only a recent Gemini result. A fallback can
  // be retried on refresh in case the external service becomes available.
  const recentInsight = await WellnessInsight.findOne(cacheFilter)
    .sort({
      generatedAt: -1,
    })
    .lean();

  if (recentInsight) {
    return {
      insight: recentInsight,
      reused: true,
    };
  }

  let summaryData = await generateGeminiWellnessSummary(analysis.reports);
  let generatedBy = "gemini";

  if (!summaryData) {
    summaryData = buildFallbackWellnessSummary(analysis);
    generatedBy = "fallback";
  }

  // analyzeRecentWellnessReports sorts newest first. Array position 0 is the
  // newest report and length - 1 is the final, oldest report.
  const newestReport = analysis.reports[0];
  const oldestReportIndex = analysis.reports.length - 1;
  const oldestReport = analysis.reports[oldestReportIndex];
  const reportIds = [];

  for (const report of analysis.reports) {
    // push adds the source ID to the end of the array stored for traceability.
    reportIds.push(report._id);
  }

  const insightInput = {
    elderlyProfileId,
    reportIds,
    reportSignature,
    periodStart: oldestReport.visitDate,
    periodEnd: newestReport.visitDate,
    summary: summaryData.summary,
    highlights: summaryData.highlights,
    recommendedFollowUp: summaryData.recommendedFollowUp,
    generatedBy,
    generatedAt: new Date(),
  };

  // create validates insightInput against the schema and inserts one document.
  const insightDocument = await WellnessInsight.create(insightInput);

  // toObject converts the Mongoose document to a plain response-safe object.
  const plainInsight = insightDocument.toObject();

  return {
    insight: plainInsight,
    reused: false,
  };
}
