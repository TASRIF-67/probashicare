import { api } from "./api.js";

/**
 * Creates and owner-links an elderly profile.
 * @param {Record<string, unknown>} payload - Complete elderly profile form data.
 * @returns {Promise<{profile: object}>} Created profile with family access metadata.
 * @sideEffects Calls POST `/elderly-profiles` and writes profile/link records.
 */
async function createProfile(payload) {
  // The Axios method returns a Promise. 'await' pauses this async function until
  // the backend responds, or throws when the request fails.
  const response = await api.post("/elderly-profiles", payload);
  // Axios stores the parsed backend body in response.data. ProbashiCare stores
  // the useful endpoint result one level deeper in response.data.data.
  // 'return' resolves this async function's Promise with that useful result.
  return response.data.data;
}

/**
 * Lists elderly profiles available to the current family.
 * @param {"active"|"archived"|"all"} [status="active"] - Profile status filter.
 * @returns {Promise<{profiles: object[], count: number}>} Authorized profile collection.
 * @sideEffects Calls GET `/elderly-profiles`.
 */
async function listProfiles(status = "active") {
  // The Axios method returns a Promise. 'await' pauses this async function until
  // the backend responds, or throws when the request fails.
  const response = await api.get("/elderly-profiles", { params: { status } });
  // Axios stores the parsed backend body in response.data. ProbashiCare stores
  // the useful endpoint result one level deeper in response.data.data.
  // 'return' resolves this async function's Promise with that useful result.
  return response.data.data;
}

/**
 * Retrieves one family-authorized elderly profile.
 * @param {string} profileId - Elderly profile identifier.
 * @returns {Promise<{profile: object}>} Full authorized profile.
 * @sideEffects Calls GET `/elderly-profiles/:profileId`.
 */
async function getProfile(profileId) {
  // The Axios method returns a Promise. 'await' pauses this async function until
  // the backend responds, or throws when the request fails.
  const response = await api.get(`/elderly-profiles/${profileId}`);
  // Axios stores the parsed backend body in response.data. ProbashiCare stores
  // the useful endpoint result one level deeper in response.data.data.
  // 'return' resolves this async function's Promise with that useful result.
  return response.data.data;
}

/**
 * Replaces all editable information for one authorized elderly profile.
 * @param {string} profileId - Elderly profile identifier.
 * @param {Record<string, unknown>} payload - Complete editable profile data.
 * @returns {Promise<{profile: object}>} Updated profile.
 * @sideEffects Calls PUT `/elderly-profiles/:profileId` and writes profile data.
 */
async function updateProfile(profileId, payload) {
  // The Axios method returns a Promise. 'await' pauses this async function until
  // the backend responds, or throws when the request fails.
  const response = await api.put(`/elderly-profiles/${profileId}`, payload);
  // Axios stores the parsed backend body in response.data. ProbashiCare stores
  // the useful endpoint result one level deeper in response.data.data.
  // 'return' resolves this async function's Promise with that useful result.
  return response.data.data;
}

/**
 * Replaces the personal-information section of an elderly profile.
 * @param {string} profileId - Elderly profile identifier.
 * @param {Record<string, unknown>} personalInformation - Complete personal section.
 * @returns {Promise<{profile: object}>} Updated profile.
 * @sideEffects Calls PATCH and writes the profile and owner relationship.
 */
async function updatePersonalInformation(profileId, personalInformation) {
  // The Axios method returns a Promise. 'await' pauses this async function until
  // the backend responds, or throws when the request fails.
  const response = await api.patch(`/elderly-profiles/${profileId}/personal-information`, {
    personalInformation,
  });
  // Axios stores the parsed backend body in response.data. ProbashiCare stores
  // the useful endpoint result one level deeper in response.data.data.
  // 'return' resolves this async function's Promise with that useful result.
  return response.data.data;
}

/**
 * Replaces one medical or emergency-contact section.
 * @param {string} profileId - Elderly profile identifier.
 * @param {string} section - Supported embedded section name.
 * @param {object[]} items - Complete replacement list.
 * @returns {Promise<{profile: object}>} Updated profile.
 * @sideEffects Calls PUT and writes one embedded profile section.
 */
async function updateSection(profileId, section, items) {
  // The Axios method returns a Promise. 'await' pauses this async function until
  // the backend responds, or throws when the request fails.
  const response = await api.put(`/elderly-profiles/${profileId}/${section}`, { items });
  // Axios stores the parsed backend body in response.data. ProbashiCare stores
  // the useful endpoint result one level deeper in response.data.data.
  // 'return' resolves this async function's Promise with that useful result.
  return response.data.data;
}

/**
 * Archives an owner-controlled elderly profile.
 * @param {string} profileId - Elderly profile identifier.
 * @returns {Promise<{profile: object}>} Archived profile.
 * @sideEffects Calls PATCH and changes the profile status in MongoDB.
 */
async function archiveProfile(profileId) {
  // The Axios method returns a Promise. 'await' pauses this async function until
  // the backend responds, or throws when the request fails.
  const response = await api.patch(`/elderly-profiles/${profileId}/archive`);
  // Axios stores the parsed backend body in response.data. ProbashiCare stores
  // the useful endpoint result one level deeper in response.data.data.
  // 'return' resolves this async function's Promise with that useful result.
  return response.data.data;
}

/*
 * To add a similar profile operation, add a method here that returns only
 * `response.data.data`, expose it through the relevant hook or page, then render
 * feedback with the shared loading, error, and toast patterns.
 */
export const elderlyProfileService = {
  createProfile,
  listProfiles,
  getProfile,
  updateProfile,
  updatePersonalInformation,
  updateSection,
  archiveProfile,
};
