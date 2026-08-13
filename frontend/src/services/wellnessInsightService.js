import { api } from "./api.js";

/** Gets the latest saved insight without generating one. @param {string} profileId - Profile ID. @returns {Promise<object>} Latest-insight data. @sideEffects Calls the API. */
async function getLatestInsight(profileId) {
  const response = await api.get("/elderly-profiles/" + profileId + "/wellness-insights/latest");
  return response.data.data;
}

/** Generates or reuses a recent insight. @param {string} profileId - Profile ID. @returns {Promise<object>} Generated insight data. @sideEffects Calls a backend endpoint that may contact Gemini. */
async function generateInsight(profileId) {
  const response = await api.post("/elderly-profiles/" + profileId + "/wellness-insights/generate");
  return response.data.data;
}

export const wellnessInsightService = { getLatestInsight, generateInsight };
