import { api } from "./api.js";

/**
 * Loads the most recently saved wellness insight without generating a new one.
 * @param {string} profileId - Authorized elderly-profile identifier.
 * @returns {Promise<{insight: object|null}>} A Promise containing the saved insight or null.
 * @sideEffects Sends an authenticated GET request to the backend.
 */
async function getLatestInsight(profileId) {
  const endpoint =
    "/elderly-profiles/" + profileId + "/wellness-insights/latest";

  // api.get returns an Axios Promise. await pauses this async function until
  // the backend responds or the Promise rejects with an error.
  const response = await api.get(endpoint);

  // Axios stores the JSON response body in response.data. The backend places
  // this endpoint's useful result inside its nested data property.
  const responseData = response.data.data;

  // Returning from an async function resolves its Promise with this object.
  return responseData;
}

/**
 * Requests a new Gemini summary or a local fallback summary.
 * @param {string} profileId - Authorized elderly-profile identifier.
 * @returns {Promise<{insight: object, generatedBy: string, reused: boolean}>} Generation result.
 * @sideEffects Sends an authenticated POST request; the backend may contact Gemini and create a WellnessInsight document.
 */
async function generateInsight(profileId) {
  const endpoint =
    "/elderly-profiles/" + profileId + "/wellness-insights/generate";

  // api.post returns a Promise. No request body is needed because the profile
  // ID is in the URL and the backend obtains the family user from the session.
  const response = await api.post(endpoint);
  const responseData = response.data.data;

  return responseData;
}

// This object groups the two functions under one predictable service name.
export const wellnessInsightService = {
  getLatestInsight,
  generateInsight,
};
