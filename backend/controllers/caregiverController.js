import { CaregiverProfile } from "../models/CaregiverProfile.js";
import { User } from "../models/User.js";
import { validateCaregiverApplication } from "../middleware/validateCaregiver.js";
import {
  createCaregiverDocumentUrl,
  deleteCaregiverDocument,
  uploadCaregiverDocument,
} from "../services/cloudinaryService.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";

/**
 * Creates the caregiver application response with identity and a signed document URL.
 * @param {import("../models/CaregiverProfile.js").CaregiverProfile|null} profile - Caregiver profile document.
 * @param {import("../models/User.js").User} user - Authenticated caregiver User.
 * @returns {Record<string, unknown>} Public caregiver application representation.
 * @sideEffects Generates a short-lived Cloudinary signature when a document exists.
 */
function toCaregiverApplicationResponse(profile, user) {
  const fallback = {
    userId: user._id,
    phone: "",
    bio: "",
    skills: [],
    languages: [],
    yearsOfExperience: null,
    hourlyRate: null,
    monthlyRate: null,
    serviceArea: "",
    availability: [],
    applicationStatus: "draft",
    rejectionReason: "",
    verificationDocument: null,
  };
  const application = profile ? profile.toObject() : fallback;
  const document = application.verificationDocument?.publicId
    ? {
        ...application.verificationDocument,
        accessUrl: createCaregiverDocumentUrl(application.verificationDocument),
      }
    : null;
  return {
    ...application,
    verificationDocument: document,
    isVerificationDocumentRequired: env.requireCaregiverDocument,
    user: { id: user._id.toString(), name: user.name, email: user.email },
  };
}

/**
 * Creates a missing draft profile for a verified caregiver.
 * @param {import("../models/CaregiverProfile.js").CaregiverProfile|null} profile - Existing profile when available.
 * @param {import("../models/User.js").User} user - Authenticated caregiver User.
 * @returns {Promise<import("../models/CaregiverProfile.js").CaregiverProfile>} Existing or newly created draft.
 * @sideEffects May create a CaregiverProfile in MongoDB.
 */
async function ensureDraftProfile(profile, user) {
  if (profile) return profile;
  return CaregiverProfile.create({
    userId: user._id,
    phone: "",
    applicationStatus: "draft",
  });
}

/**
 * GET /api/caregivers/application
 * Body/params/query: none.
 * Success 200: `{ success: true, data: { application } }`.
 * Failure: standard authentication error shape.
 * Auth: verified authenticated `caregiver`; every application status is allowed.
 * @param {import("express").Request} request - Request with loaded caregiver application state.
 * @param {import("express").Response} response - Express response writer.
 * @returns {void}
 * @sideEffects Generates a signed document URL when applicable.
 */
export function getApplication(request, response) {
  response.json({
    success: true,
    data: {
      application: toCaregiverApplicationResponse(request.caregiverProfile, request.user),
    },
  });
}

/**
 * PUT /api/caregivers/application/draft
 * Body: caregiver application fields excluding status and document metadata.
 * Success 200: `{ success: true, data: { application, message } }`.
 * Failure: standard validation or status-gate error shape.
 * Auth: verified `caregiver` with `draft` or `rejected` status.
 * @param {import("express").Request} request - Authenticated editable application request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Creates or updates a draft CaregiverProfile.
 */
export async function saveApplicationDraft(request, response) {
  const profile = await ensureDraftProfile(request.caregiverProfile, request.user);
  const values = validateCaregiverApplication(request.body);
  Object.assign(profile, values);
  if (profile.applicationStatus !== "rejected") profile.applicationStatus = "draft";
  await profile.save();
  response.json({
    success: true,
    data: {
      message: "Application draft saved.",
      application: toCaregiverApplicationResponse(profile, request.user),
    },
  });
}

/**
 * POST /api/caregivers/application/document
 * Multipart body: one `document` file (PDF, JPG, or PNG; maximum 5 MB).
 * Success 200: `{ success: true, data: { application, message } }`.
 * Failure: standard missing-file, upload-configuration, type, size, or status error shape.
 * Auth: verified `caregiver` with `draft` or `rejected` status.
 * @param {import("express").Request} request - Multipart request with in-memory file.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Uploads an authenticated Cloudinary asset, updates MongoDB, and deletes the old asset.
 */
export async function uploadApplicationDocument(request, response) {
  if (!request.file) throw new ApiError(422, "Choose a verification document to upload.");
  const profile = await ensureDraftProfile(request.caregiverProfile, request.user);
  const previousDocument = profile.verificationDocument?.publicId
    ? profile.verificationDocument.toObject()
    : null;
  const document = await uploadCaregiverDocument({
    buffer: request.file.buffer,
    mimetype: request.file.mimetype,
    originalname: request.file.originalname,
    caregiverUserId: request.user._id.toString(),
  });
  try {
    profile.verificationDocument = document;
    await profile.save();
  } catch (error) {
    await deleteCaregiverDocument(document).catch((cleanupError) => {
      console.error("Could not remove unlinked caregiver document:", cleanupError.message);
    });
    throw error;
  }
  await deleteCaregiverDocument(previousDocument).catch((error) => {
    console.error("Could not remove superseded caregiver document:", error.message);
  });
  response.json({
    success: true,
    data: {
      message: "Verification document uploaded.",
      application: toCaregiverApplicationResponse(profile, request.user),
    },
  });
}

/**
 * POST /api/caregivers/application/submit
 * Body: complete caregiver application fields; document must already be uploaded.
 * Success 200: `{ success: true, data: { application, message } }`.
 * Failure: standard validation or status-gate error shape.
 * Auth: verified `caregiver` with `draft` or `rejected` status.
 * @param {import("express").Request} request - Authenticated final application request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Updates CaregiverProfile, clears rejection review state, and marks it submitted.
 */
export async function submitApplication(request, response) {
  const profile = await ensureDraftProfile(request.caregiverProfile, request.user);
  const values = validateCaregiverApplication(request.body, {
    isSubmission: true,
    hasDocument: Boolean(profile.verificationDocument?.publicId),
    requireDocument: env.requireCaregiverDocument,
  });
  Object.assign(profile, values, {
    applicationStatus: "submitted",
    submittedAt: new Date(),
    rejectionReason: "",
    reviewedAt: null,
    reviewedBy: null,
  });
  await profile.save();
  response.json({
    success: true,
    data: {
      message: "Application submitted for review.",
      application: toCaregiverApplicationResponse(profile, request.user),
    },
  });
}

/**
 * PUT /api/caregivers/profile
 * Body: complete editable caregiver fields excluding document and review state.
 * Success 200: `{ success: true, data: { application, message } }`.
 * Failure: standard validation or status-gate error shape.
 * Auth: verified `caregiver` with `approved` status only.
 * @param {import("express").Request} request - Approved caregiver profile update.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Updates ordinary caregiver profile/rate/availability fields without re-review.
 */
export async function updateApprovedProfile(request, response) {
  if (!request.caregiverProfile) throw new ApiError(404, "Caregiver profile not found.");
  const values = validateCaregiverApplication(request.body, {
    isSubmission: true,
    hasDocument: Boolean(request.caregiverProfile.verificationDocument?.publicId),
    requireDocument: env.requireCaregiverDocument,
  });
  Object.assign(request.caregiverProfile, values);
  await request.caregiverProfile.save();
  const user = await User.findById(request.user._id);
  response.json({
    success: true,
    data: {
      message: "Caregiver profile updated.",
      application: toCaregiverApplicationResponse(request.caregiverProfile, user),
    },
  });
}
