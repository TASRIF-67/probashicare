import { WELLNESS_ALERT_RULES } from "../config/wellnessAlertRules.js";
import { WellnessAlert } from "../models/WellnessAlert.js";
import { WellnessReport } from "../models/WellnessReport.js";

/**
 * Creates one normalized rule result.
 * @param {object} input - Rule-specific alert fields.
 * @returns {object} Rule result ready for persistence.
 * @sideEffects None.
 */
function createRuleResult(input) {
  return {
    ruleId: input.ruleId,
    category: input.category,
    severity: input.severity,
    title: input.title,
    message: input.message,
    detectedValues: input.detectedValues,
    sourceReportIds: input.sourceReportIds,
  };
}

/**
 * Adds repeated blood-pressure alerts when enough submitted readings match.
 * @param {object[]} reports - Recent submitted reports.
 * @param {object[]} results - Mutable analysis-result list.
 * @returns {void}
 * @sideEffects Adds matching rule results to the supplied list.
 */
function analyzeBloodPressure(reports, results) {
  const highReadings = [];
  const lowReadings = [];
  const thresholds = WELLNESS_ALERT_RULES.bloodPressure;

  for (const report of reports) {
    const vitals = report.vitals || {};

    if (
      Number.isFinite(vitals.systolic) &&
      Number.isFinite(vitals.diastolic)
    ) {
      const reading = {
        reportId: report._id,
        systolic: vitals.systolic,
        diastolic: vitals.diastolic,
        visitDate: report.visitDate,
      };

      if (
        vitals.systolic >= thresholds.highSystolic ||
        vitals.diastolic >= thresholds.highDiastolic
      ) {
        highReadings.push(reading);
      }

      if (
        vitals.systolic <= thresholds.lowSystolic ||
        vitals.diastolic <= thresholds.lowDiastolic
      ) {
        lowReadings.push(reading);
      }
    }
  }

  if (highReadings.length >= WELLNESS_ALERT_RULES.repeatedCount) {
    results.push(createRuleResult({
      ruleId: "repeated-high-blood-pressure",
      category: "blood_pressure",
      severity: "high",
      title: "Repeated elevated blood-pressure readings",
      message: "Multiple recent reports contain elevated blood-pressure readings.",
      detectedValues: {
        unit: "mmHg",
        readings: highReadings,
      },
      sourceReportIds: highReadings.map((reading) => reading.reportId),
    }));
  }

  if (lowReadings.length >= WELLNESS_ALERT_RULES.repeatedCount) {
    results.push(createRuleResult({
      ruleId: "repeated-low-blood-pressure",
      category: "blood_pressure",
      severity: "high",
      title: "Repeated low blood-pressure readings",
      message: "Multiple recent reports contain low blood-pressure readings.",
      detectedValues: {
        unit: "mmHg",
        readings: lowReadings,
      },
      sourceReportIds: lowReadings.map((reading) => reading.reportId),
    }));
  }
}

/**
 * Adds repeated blood-sugar alerts using the existing mg/dL storage convention.
 * @param {object[]} reports - Recent submitted reports.
 * @param {object[]} results - Mutable analysis-result list.
 * @returns {void}
 * @sideEffects Adds matching rule results to the supplied list.
 */
function analyzeBloodSugar(reports, results) {
  const highReadings = [];
  const lowReadings = [];
  const thresholds = WELLNESS_ALERT_RULES.bloodSugarMgDl;

  for (const report of reports) {
    const value = report.vitals?.bloodSugar;

    if (!Number.isFinite(value)) {
      continue;
    }

    const reading = {
      reportId: report._id,
      value,
      unit: "mg/dL",
      context: report.vitals.bloodSugarContext || "unknown",
      visitDate: report.visitDate,
    };

    if (value >= thresholds.high) {
      highReadings.push(reading);
    }

    if (value <= thresholds.low) {
      lowReadings.push(reading);
    }
  }

  if (highReadings.length >= WELLNESS_ALERT_RULES.repeatedCount) {
    results.push(createRuleResult({
      ruleId: "repeated-elevated-blood-sugar",
      category: "blood_sugar",
      severity: "high",
      title: "Repeated elevated blood-sugar readings",
      message: "Multiple recent reports contain elevated blood-sugar readings.",
      detectedValues: {
        unit: "mg/dL",
        readings: highReadings,
      },
      sourceReportIds: highReadings.map((reading) => reading.reportId),
    }));
  }

  if (lowReadings.length >= WELLNESS_ALERT_RULES.repeatedCount) {
    results.push(createRuleResult({
      ruleId: "repeated-low-blood-sugar",
      category: "blood_sugar",
      severity: "high",
      title: "Repeated low blood-sugar readings",
      message: "Multiple recent reports contain low blood-sugar readings.",
      detectedValues: {
        unit: "mg/dL",
        readings: lowReadings,
      },
      sourceReportIds: lowReadings.map((reading) => reading.reportId),
    }));
  }
}

/**
 * Adds a weight-change alert when first and latest measurements differ enough.
 * @param {object[]} reports - Recent submitted reports ordered newest first.
 * @param {object[]} results - Mutable analysis-result list.
 * @returns {void}
 * @sideEffects Adds a matching rule result to the supplied list.
 */
function analyzeWeight(reports, results) {
  const readings = [];

  for (const report of reports) {
    const weightKg = report.vitals?.weightKg;

    if (Number.isFinite(weightKg)) {
      readings.push({
        reportId: report._id,
        value: weightKg,
        visitDate: report.visitDate,
      });
    }
  }

  if (readings.length < 2) {
    return;
  }

  const latest = readings[0];
  const oldest = readings[readings.length - 1];
  const changePercent =
    Math.abs((latest.value - oldest.value) / oldest.value) * 100;

  if (changePercent >= WELLNESS_ALERT_RULES.weightChangePercent) {
    results.push(createRuleResult({
      ruleId: "significant-weight-change",
      category: "weight",
      severity: "medium",
      title: "Notable recent weight change",
      message: "Recent recorded weights changed by at least the demonstration threshold.",
      detectedValues: {
        unit: "kg",
        oldest,
        latest,
        changePercent: Number(changePercent.toFixed(1)),
      },
      sourceReportIds: [oldest.reportId, latest.reportId],
    }));
  }
}

/**
 * Adds repeated medicine, meal, and mood rule results.
 * @param {object[]} reports - Recent submitted reports.
 * @param {object[]} results - Mutable analysis-result list.
 * @returns {void}
 * @sideEffects Adds matching rule results to the supplied list.
 */
function analyzeDailyWellness(reports, results) {
  const medicineReports = [];
  const mealReports = [];
  const moodReports = [];

  for (const report of reports) {
    if (["missed", "partially-taken"].includes(report.medicineIntakeStatus)) {
      medicineReports.push(report);
    }

    if (["missed", "partial"].includes(report.mealStatus)) {
      mealReports.push(report);
    }

    if (["low", "distressed"].includes(report.mood)) {
      moodReports.push(report);
    }
  }

  const repeatedCount = WELLNESS_ALERT_RULES.repeatedCount;

  if (medicineReports.length >= repeatedCount) {
    results.push(createRuleResult({
      ruleId: "repeated-medicine-not-taken",
      category: "medicine",
      severity: "high",
      title: "Repeated medicine-intake concerns",
      message: "Multiple recent reports show missed or partially taken medicine.",
      detectedValues: {
        count: medicineReports.length,
        statuses: medicineReports.map((report) => report.medicineIntakeStatus),
      },
      sourceReportIds: medicineReports.map((report) => report._id),
    }));
  }

  if (mealReports.length >= repeatedCount) {
    results.push(createRuleResult({
      ruleId: "repeated-incomplete-meals",
      category: "meal",
      severity: "medium",
      title: "Repeated meal-intake concerns",
      message: "Multiple recent reports show missed or partially completed meals.",
      detectedValues: {
        count: mealReports.length,
        statuses: mealReports.map((report) => report.mealStatus),
      },
      sourceReportIds: mealReports.map((report) => report._id),
    }));
  }

  if (moodReports.length >= repeatedCount) {
    results.push(createRuleResult({
      ruleId: "repeated-low-mood",
      category: "mood",
      severity: "medium",
      title: "Repeated low mood reports",
      message: "Multiple recent reports describe low or distressed mood.",
      detectedValues: {
        count: moodReports.length,
        moods: moodReports.map((report) => report.mood),
      },
      sourceReportIds: moodReports.map((report) => report._id),
    }));
  }
}

/**
 * Builds a stable key from a rule and the exact reports that triggered it.
 * @param {string} ruleId - Deterministic rule identifier.
 * @param {Array<string|import("mongoose").Types.ObjectId>} reportIds - Source reports.
 * @returns {string} Stable deduplication key.
 * @sideEffects None.
 */
function buildDedupeKey(ruleId, reportIds) {
  const values = [];

  for (const reportId of reportIds) {
    values.push(reportId.toString());
  }

  values.sort();
  return ruleId + ":" + values.join(",");
}

/**
 * Analyzes recent submitted reports without writing alerts.
 * @param {string|import("mongoose").Types.ObjectId} elderlyProfileId - Elderly profile ID.
 * @returns {Promise<{reports: object[], ruleResults: object[]}>} Recent reports and deterministic findings.
 * @sideEffects Reads submitted WellnessReport documents.
 */
export async function analyzeRecentWellnessReports(elderlyProfileId) {
  const reports = await WellnessReport.find({
    elderlyProfileId,
    status: "submitted",
  })
    .sort({ visitDate: -1, submittedAt: -1 })
    .limit(WELLNESS_ALERT_RULES.recentReportLimit)
    .lean();

  const ruleResults = analyzeWellnessReportValues(reports);

  return {
    reports,
    ruleResults,
  };
}

/**
 * Runs deterministic rules against supplied submitted-report values.
 * @param {object[]} reports - Wellness reports, including optional drafts.
 * @returns {object[]} Rule results based only on submitted reports.
 * @sideEffects None.
 */
export function analyzeWellnessReportValues(reports) {
  const submittedReports = [];

  for (const report of reports) {
    if (report.status === "submitted") {
      submittedReports.push(report);
    }
  }

  const ruleResults = [];
  analyzeBloodPressure(submittedReports, ruleResults);
  analyzeBloodSugar(submittedReports, ruleResults);
  analyzeWeight(submittedReports, ruleResults);
  analyzeDailyWellness(submittedReports, ruleResults);
  return ruleResults;
}

/**
 * Runs deterministic analysis and creates only missing alerts.
 * @param {string|import("mongoose").Types.ObjectId} elderlyProfileId - Elderly profile ID.
 * @returns {Promise<{reports: object[], ruleResults: object[], alerts: object[]}>} Analysis and persisted alerts.
 * @sideEffects Reads reports and upserts WellnessAlert documents.
 */
export async function analyzeAndCreateWellnessAlerts(elderlyProfileId) {
  const analysis = await analyzeRecentWellnessReports(elderlyProfileId);
  const alerts = [];

  for (const result of analysis.ruleResults) {
    const dedupeKey = buildDedupeKey(
      result.ruleId,
      result.sourceReportIds,
    );
    const alert = await WellnessAlert.findOneAndUpdate(
      {
        dedupeKey,
      },
      {
        $setOnInsert: {
          elderlyProfileId,
          sourceReportIds: result.sourceReportIds,
          category: result.category,
          severity: result.severity,
          title: result.title,
          message: result.message,
          detectedValues: result.detectedValues,
          triggeredRules: [result.ruleId],
          dedupeKey,
          status: "active",
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
    alerts.push(alert);
  }

  return {
    reports: analysis.reports,
    ruleResults: analysis.ruleResults,
    alerts,
  };
}

/*
 * To add a rule, create one focused analyzer that returns createRuleResult data,
 * add its thresholds to wellnessAlertRules, and call it from
 * analyzeRecentWellnessReports. Gemini must never be used to create or grade it.
 */
