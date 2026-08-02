import { api } from "./api.js";

/**
 * Retrieves the current caregiver application and signed document link.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<{application: object}>} Current caregiver application.
 * @sideEffects Calls GET `/caregivers/application`.
 */
async function getApplication() {
  const response = await api.get("/caregivers/application");
  return response.data.data;
}

/**
 * Saves incomplete or complete caregiver fields without submitting for review.
 * @param {Record<string, unknown>} payload - Editable application fields.
 * @returns {Promise<{application: object, message: string}>} Saved draft and confirmation.
 * @sideEffects Calls PUT `/caregivers/application/draft` and writes MongoDB.
 */
async function saveDraft(payload) {
  const response = await api.put("/caregivers/application/draft", payload);
  return response.data.data;
}

/**
 * Uploads one verification document using multipart form data.
 * @param {File} file - PDF, JPEG, or PNG file up to 5 MB.
 * @returns {Promise<{application: object, message: string}>} Updated application and confirmation.
 * @sideEffects Uploads through POST `/caregivers/application/document` to Cloudinary.
 */
async function uploadDocument(file) {
  const formData = new FormData();
  formData.append("document", file);
  const response = await api.post("/caregivers/application/document", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return response.data.data;
}

/**
 * Validates and submits a caregiver application for admin review.
 * @param {Record<string, unknown>} payload - Complete application fields.
 * @returns {Promise<{application: object, message: string}>} Submitted application and confirmation.
 * @sideEffects Calls POST `/caregivers/application/submit` and locks the application.
 */
async function submitApplication(payload) {
  const response = await api.post("/caregivers/application/submit", payload);
  return response.data.data;
}

/**
 * Updates ordinary fields for an already approved caregiver.
 * @param {Record<string, unknown>} payload - Complete editable caregiver fields.
 * @returns {Promise<{application: object, message: string}>} Updated profile and confirmation.
 * @sideEffects Calls PUT `/caregivers/profile` without changing approval status.
 */
async function updateApprovedProfile(payload) {
  const response = await api.put("/caregivers/profile", payload);
  return response.data.data;
}

export const caregiverService = {
  getApplication,
  saveDraft,
  uploadDocument,
  submitApplication,
  updateApprovedProfile,
};
