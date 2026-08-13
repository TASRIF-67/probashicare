import { api } from "./api.js";

/**
 * Lists care assignments available to the current approved caregiver for reporting.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<{assignments: object[], count: number}>} Reportable assignment summaries.
 * @sideEffects Calls GET `/wellness-reports/assignments`.
 */
async function listAssignments() {
  const response = await api.get("/wellness-reports/assignments");
  return response.data.data;
}

/**
 * Creates a caregiver-owned wellness-report draft.
 * @param {Record<string, unknown>} payload - Complete editable report values.
 * @returns {Promise<{report: object, message: string}>} Created report draft and feedback.
 * @sideEffects Calls POST `/wellness-reports` and writes a report.
 */
async function createReport(payload) {
  const response = await api.post("/wellness-reports", payload);
  return response.data.data;
}

/**
 * Replaces the editable fields of a caregiver-owned draft.
 * @param {string} reportId - WellnessReport identifier.
 * @param {Record<string, unknown>} payload - Complete editable report values.
 * @returns {Promise<{report: object, message: string}>} Updated draft and feedback.
 * @sideEffects Calls PUT `/wellness-reports/:reportId` and writes a report.
 */
async function updateDraft(reportId, payload) {
  const response = await api.put(`/wellness-reports/${reportId}`, payload);
  return response.data.data;
}

/**
 * Finalizes a stored caregiver-owned draft.
 * @param {string} reportId - WellnessReport identifier.
 * @returns {Promise<{report: object, message: string}>} Submitted immutable report and feedback.
 * @sideEffects Calls POST `/wellness-reports/:reportId/submit` and changes report state.
 */
async function submitReport(reportId) {
  const response = await api.post(`/wellness-reports/${reportId}/submit`);
  return response.data.data;
}

/**
 * Lists reports created by the current caregiver.
 * @param {{status?: "draft"|"submitted", page?: number, limit?: number}} [options] - Optional status and pagination filters.
 * @returns {Promise<{reports: object[], pagination: object}>} Caregiver-owned report page.
 * @sideEffects Calls GET `/wellness-reports/mine`.
 */
async function listMyReports(options = {}) {
  const response = await api.get("/wellness-reports/mine", { params: options });
  return response.data.data;
}

/**
 * Retrieves one report visible to the current caregiver or linked family member.
 * @param {string} reportId - WellnessReport identifier.
 * @returns {Promise<{report: object}>} Authorized report detail.
 * @sideEffects Calls GET `/wellness-reports/:reportId`.
 */
async function getReport(reportId) {
  const response = await api.get(`/wellness-reports/${reportId}`);
  return response.data.data;
}

/**
 * Lists submitted reports for one family-authorized elderly profile.
 * @param {string} profileId - ElderlyProfile identifier.
 * @param {{page?: number, limit?: number}} [options] - Optional pagination filters.
 * @returns {Promise<{reports: object[], pagination: object}>} Submitted report page.
 * @sideEffects Calls GET `/wellness-reports/elderly/:profileId`.
 */
async function listElderlyReports(profileId, options = {}) {
  const response = await api.get(`/wellness-reports/elderly/${profileId}`, { params: options });
  return response.data.data;
}

/**
 * Loads submitted vitals points for a family-authorized elderly profile.
 * @param {string} profileId - ElderlyProfile identifier.
 * @param {{from?: string, to?: string}} [range] - Optional ISO date range.
 * @returns {Promise<{points: object[], from: string, to: string}>} Chronological vitals series.
 * @sideEffects Calls GET `/wellness-reports/elderly/:profileId/vitals`.
 */
async function getVitalsTrends(profileId, range = {}) {
  const response = await api.get(`/wellness-reports/elderly/${profileId}/vitals`, {
    params: range,
  });
  return response.data.data;
}

/*
 * To add a similar report operation, add a focused method returning only
 * `response.data.data`, then consume it through the report editor, history page,
 * or a dedicated hook while preserving normalized API errors and shared toasts.
 */
export const wellnessReportService = {
  listAssignments,
  createReport,
  updateDraft,
  submitReport,
  listMyReports,
  getReport,
  listElderlyReports,
  getVitalsTrends,
};
