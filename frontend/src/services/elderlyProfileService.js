import { api } from "./api.js";

/**
 * Creates and owner-links an elderly profile.
 * @param {Record<string, unknown>} payload - Complete elderly profile form data.
 * @returns {Promise<{profile: object}>} Created profile with family access metadata.
 * @sideEffects Calls POST `/elderly-profiles` and writes profile/link records.
 */
async function createProfile(payload) {
  const response = await api.post("/elderly-profiles", payload);
  return response.data.data;
}

/**
 * Lists elderly profiles available to the current family.
 * @param {"active"|"archived"|"all"} [status="active"] - Profile status filter.
 * @returns {Promise<{profiles: object[], count: number}>} Authorized profile collection.
 * @sideEffects Calls GET `/elderly-profiles`.
 */
async function listProfiles(status = "active") {
  const response = await api.get("/elderly-profiles", { params: { status } });
  return response.data.data;
}

/**
 * Retrieves one family-authorized elderly profile.
 * @param {string} profileId - Elderly profile identifier.
 * @returns {Promise<{profile: object}>} Full authorized profile.
 * @sideEffects Calls GET `/elderly-profiles/:profileId`.
 */
async function getProfile(profileId) {
  const response = await api.get(`/elderly-profiles/${profileId}`);
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
  const response = await api.put(`/elderly-profiles/${profileId}`, payload);
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
  const response = await api.patch(`/elderly-profiles/${profileId}/personal-information`, {
    personalInformation,
  });
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
  const response = await api.put(`/elderly-profiles/${profileId}/${section}`, { items });
  return response.data.data;
}

/**
 * Archives an owner-controlled elderly profile.
 * @param {string} profileId - Elderly profile identifier.
 * @returns {Promise<{profile: object}>} Archived profile.
 * @sideEffects Calls PATCH and changes the profile status in MongoDB.
 */
async function archiveProfile(profileId) {
  const response = await api.patch(`/elderly-profiles/${profileId}/archive`);
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
