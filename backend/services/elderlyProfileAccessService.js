import mongoose from "mongoose";
import { ElderlyFamilyLink } from "../models/ElderlyFamilyLink.js";
import { ElderlyProfile } from "../models/ElderlyProfile.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Checks whether a family user has at least one active, non-archived elderly profile.
 * @param {string|import("mongoose").Types.ObjectId} familyUserId - Authenticated family user ID.
 * @returns {Promise<boolean>} `true` when an eligible link and profile exist.
 * @sideEffects Reads family links and elderly profiles from MongoDB.
 */
export async function familyHasActiveElderlyProfiles(familyUserId) {
  const links = await ElderlyFamilyLink.find({
    familyUserId,
    status: "active",
  }).select("elderlyProfileId");
  if (!links.length) return false;

  return Boolean(
    await ElderlyProfile.exists({
      _id: { $in: links.map((link) => link.elderlyProfileId) },
      status: "active",
    }),
  );
}

/**
 * Loads an elderly profile only when the family has the required active permission.
 * @param {{profileId: string, familyUserId: string|import("mongoose").Types.ObjectId, permissions?: string[], includeArchived?: boolean}} options - Profile, family, and access constraints.
 * @returns {Promise<{profile: import("../models/ElderlyProfile.js").ElderlyProfile, link: import("../models/ElderlyFamilyLink.js").ElderlyFamilyLink}>} Authorized documents.
 * @sideEffects Reads MongoDB; returns 404 for invalid IDs and unauthorized records to prevent disclosure.
 */
export async function getAuthorizedElderlyProfile({
  profileId,
  familyUserId,
  permissions = ["owner", "editor", "viewer"],
  includeArchived = false,
}) {
  if (!mongoose.isValidObjectId(profileId)) {
    throw new ApiError(404, "Elderly profile not found.");
  }

  const link = await ElderlyFamilyLink.findOne({
    elderlyProfileId: profileId,
    familyUserId,
    permission: { $in: permissions },
    status: "active",
  });
  if (!link) throw new ApiError(404, "Elderly profile not found.");

  const profile = await ElderlyProfile.findOne({
    _id: profileId,
    ...(includeArchived ? {} : { status: "active" }),
  });
  if (!profile) throw new ApiError(404, "Elderly profile not found.");

  return { profile, link };
}
