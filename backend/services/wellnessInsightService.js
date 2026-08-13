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

  reportIds.sort();
  return reportIds.join(",");
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

  if (!highlights.length) {
    highlights.push("No demonstration alert rule was triggered in this period.");
  }

  const summary =
    "This summary covers " +
    reportCount +
    " recent submitted wellness report" +
    (reportCount === 1 ? "" : "s") +
    ". It describes recorded patterns only and is not a diagnosis.";
  let recommendedFollowUp =
    "Continue reviewing regular wellness reports and recorded changes.";

  if (analysis.ruleResults.length) {
    recommendedFollowUp =
      "Consider discussing repeated or concerning recorded changes with a qualified healthcare professional.";
  }

  return {
    summary,
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
  return WellnessInsight.findOne({
    elderlyProfileId,
  })
    .sort({ generatedAt: -1 })
    .lean();
}

/**
 * Generates or reuses a recent insight for unchanged submitted reports.
 * @param {string|import("mongoose").Types.ObjectId} elderlyProfileId - Elderly profile ID.
 * @returns {Promise<{insight: object, reused: boolean}>} Saved insight and cache indicator.
 * @sideEffects Reads reports, may call Gemini, and may create WellnessInsight.
 */
export async function generateWellnessInsight(elderlyProfileId) {
  const analysis = await analyzeRecentWellnessReports(elderlyProfileId);

  if (!analysis.reports.length) {
    return {
      insight: null,
      reused: false,
    };
  }

  const reportSignature = buildReportSignature(analysis.reports);
  const cooldownStart = new Date(Date.now() - REGENERATION_COOLDOWN_MS);
  const recentInsight = await WellnessInsight.findOne({
    elderlyProfileId,
    reportSignature,
    generatedBy: "gemini",
    generatedAt: {
      $gte: cooldownStart,
    },
  })
    .sort({ generatedAt: -1 })
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

  const newestReport = analysis.reports[0];
  const oldestReport = analysis.reports[analysis.reports.length - 1];
  const reportIds = [];

  for (const report of analysis.reports) {
    reportIds.push(report._id);
  }

  const insight = await WellnessInsight.create({
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
  });

  return {
    insight: insight.toObject(),
    reused: false,
  };
}
