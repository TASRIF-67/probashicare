import { api } from "./api.js";

/**
 * Lists family-authorized wellness alerts using optional filters.
 * @param {string} profileId - Authorized elderly-profile identifier.
 * @param {object} [filters={}] - Page, limit, status, severity, or category query values.
 * @returns {Promise<object>} Alert list, pagination, active count, and severity totals.
 * @sideEffects Sends an authenticated GET request to the backend.
 */
async function listAlerts(profileId, filters = {}) {
  const endpoint = "/elderly-profiles/" + profileId + "/wellness-alerts";
  const requestOptions = {
    // Axios turns the params object into URL query parameters.
    params: filters,
  };

  const response = await api.get(endpoint, requestOptions);
  const responseData = response.data.data;

  return responseData;
}

/**
 * Changes one active alert to acknowledged.
 * @param {string} alertId - Wellness-alert identifier.
 * @returns {Promise<object>} Updated alert and backend message.
 * @sideEffects Sends an authenticated PATCH request and updates MongoDB.
 */
async function acknowledgeAlert(alertId) {
  const endpoint = "/wellness-alerts/" + alertId + "/acknowledge";
  const response = await api.patch(endpoint);

  return response.data.data;
}

/**
 * Resolves an active or acknowledged alert with a required note.
 * @param {string} alertId - Wellness-alert identifier.
 * @param {string} resolutionNote - Family explanation for resolving the alert.
 * @returns {Promise<object>} Updated alert and backend message.
 * @sideEffects Sends an authenticated PATCH request and updates MongoDB.
 */
async function resolveAlert(alertId, resolutionNote) {
  const endpoint = "/wellness-alerts/" + alertId + "/resolve";
  const requestBody = {
    resolutionNote,
  };
  const response = await api.patch(endpoint, requestBody);

  return response.data.data;
}

export const wellnessAlertService = {
  listAlerts,
  acknowledgeAlert,
  resolveAlert,
};
