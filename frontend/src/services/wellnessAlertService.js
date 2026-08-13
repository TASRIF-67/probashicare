import { api } from "./api.js";

/** Lists family-authorized wellness alerts. @param {string} profileId - Profile ID. @param {object} [filters] - Status/severity filters. @returns {Promise<object>} Alert data. @sideEffects Calls the API. */
async function listAlerts(profileId, filters = {}) {
  const response = await api.get("/elderly-profiles/" + profileId + "/wellness-alerts", { params: filters });
  return response.data.data;
}

/** Acknowledges an active alert. @param {string} alertId - Alert ID. @returns {Promise<object>} Updated alert data. @sideEffects Calls the API. */
async function acknowledgeAlert(alertId) {
  const response = await api.patch("/wellness-alerts/" + alertId + "/acknowledge");
  return response.data.data;
}

/** Resolves an alert. @param {string} alertId - Alert ID. @param {string} resolutionNote - Required note. @returns {Promise<object>} Updated alert data. @sideEffects Calls the API. */
async function resolveAlert(alertId, resolutionNote) {
  const response = await api.patch("/wellness-alerts/" + alertId + "/resolve", { resolutionNote });
  return response.data.data;
}

export const wellnessAlertService = { listAlerts, acknowledgeAlert, resolveAlert };
