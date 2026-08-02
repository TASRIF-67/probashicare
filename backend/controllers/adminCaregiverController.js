import mongoose from "mongoose";
import { CaregiverProfile } from "../models/CaregiverProfile.js";
import { User } from "../models/User.js";
import { createCaregiverDocumentUrl } from "../services/cloudinaryService.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Produces the admin caregiver application representation.
 * @param {import("../models/CaregiverProfile.js").CaregiverProfile} profile - Populated caregiver profile.
 * @returns {Record<string, unknown>} Application data, caregiver identity, and signed document URL.
 * @sideEffects Generates a short-lived signed Cloudinary URL when configured.
 */
function toAdminApplicationResponse(profile) {
  const value = profile.toObject();
  const user = value.userId;
  return {
    ...value,
    userId: user?._id || value.userId,
    user: user?.email
      ? { id: user._id.toString(), name: user.name, email: user.email, isVerified: user.isVerified }
      : null,
    verificationDocument: value.verificationDocument?.publicId
      ? {
          ...value.verificationDocument,
          accessUrl: createCaregiverDocumentUrl(value.verificationDocument),
        }
      : null,
  };
}

/**
 * Loads a caregiver application by profile ID and populates its User identity.
 * @param {string} profileId - CaregiverProfile identifier.
 * @returns {Promise<import("../models/CaregiverProfile.js").CaregiverProfile>} Populated profile.
 * @sideEffects Reads CaregiverProfile and User from MongoDB; throws 404 for invalid IDs.
 */
async function findApplication(profileId) {
  if (!mongoose.isValidObjectId(profileId)) throw new ApiError(404, "Caregiver application not found.");
  const profile = await CaregiverProfile.findById(profileId).populate(
    "userId",
    "name email isVerified role",
  );
  if (!profile || profile.userId?.role !== "caregiver") {
    throw new ApiError(404, "Caregiver application not found.");
  }
  return profile;
}

/**
 * GET /api/admin/caregiver-applications?status=submitted
 * Query: optional application `status`; body and params are unused.
 * Success 200: `{ success: true, data: { applications: AdminApplication[], count: number } }`.
 * Failure: standard validation or authentication error shape.
 * Auth: authenticated `admin` only.
 * @param {import("express").Request} request - Admin request with optional status filter.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads and populates caregiver applications from MongoDB.
 */
export async function listCaregiverApplications(request, response) {
  const status = request.query.status || "submitted";
  const allowedStatuses = ["draft", "submitted", "approved", "rejected", "suspended", "all"];
  if (!allowedStatuses.includes(status)) throw new ApiError(422, "Choose a valid application status.");
  const profiles = await CaregiverProfile.find(status === "all" ? {} : { applicationStatus: status })
    .populate("userId", "name email isVerified role")
    .sort({ submittedAt: -1, updatedAt: -1 })
    .limit(200);
  const applications = profiles
    .filter((profile) => profile.userId?.role === "caregiver")
    .map(toAdminApplicationResponse);
  response.json({ success: true, data: { applications, count: applications.length } });
}

/**
 * GET /api/admin/caregiver-applications/:profileId
 * Params: `{ profileId: string }`; body and query are unused.
 * Success 200: `{ success: true, data: { application } }`.
 * Failure: standard concealed 404 or authentication error shape.
 * Auth: authenticated `admin` only.
 * @param {import("express").Request} request - Admin request containing application ID.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads User/Profile and generates a signed document URL.
 */
export async function getCaregiverApplication(request, response) {
  const profile = await findApplication(request.params.profileId);
  response.json({ success: true, data: { application: toAdminApplicationResponse(profile) } });
}

/**
 * PATCH /api/admin/caregiver-applications/:profileId/approve
 * Params: `{ profileId: string }`; body and query are unused.
 * Success 200: `{ success: true, data: { application, message } }`.
 * Failure: 409 unless currently submitted, otherwise standard error shape.
 * Auth: authenticated `admin` only.
 * @param {import("express").Request} request - Reviewing administrator request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Marks the application approved and stores reviewer/time.
 */
export async function approveCaregiverApplication(request, response) {
  const profile = await findApplication(request.params.profileId);
  if (profile.applicationStatus !== "submitted") {
    throw new ApiError(409, "Only submitted applications can be approved.");
  }
  Object.assign(profile, {
    applicationStatus: "approved",
    rejectionReason: "",
    reviewedBy: request.user._id,
    reviewedAt: new Date(),
  });
  await profile.save();
  response.json({
    success: true,
    data: {
      message: "Caregiver application approved.",
      application: toAdminApplicationResponse(profile),
    },
  });
}

/**
 * PATCH /api/admin/caregiver-applications/:profileId/reject
 * Params: `{ profileId: string }`; body: `{ reason: string }`; query is unused.
 * Success 200: `{ success: true, data: { application, message } }`.
 * Failure: 422 for missing reason, 409 unless submitted, or standard error shape.
 * Auth: authenticated `admin` only.
 * @param {import("express").Request} request - Reviewing administrator request and reason.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Marks the application rejected and stores reason/reviewer/time.
 */
export async function rejectCaregiverApplication(request, response) {
  const reason = request.body?.reason?.trim();
  if (!reason) throw new ApiError(422, "A rejection reason is required.", { reason: "Enter a clear reason." });
  if (reason.length > 1000) throw new ApiError(422, "Rejection reason cannot exceed 1000 characters.");
  const profile = await findApplication(request.params.profileId);
  if (profile.applicationStatus !== "submitted") {
    throw new ApiError(409, "Only submitted applications can be rejected.");
  }
  Object.assign(profile, {
    applicationStatus: "rejected",
    rejectionReason: reason,
    reviewedBy: request.user._id,
    reviewedAt: new Date(),
  });
  await profile.save();
  response.json({
    success: true,
    data: {
      message: "Caregiver application returned for changes.",
      application: toAdminApplicationResponse(profile),
    },
  });
}
