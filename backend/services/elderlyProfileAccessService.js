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
  // Access comes from active family links, not from the profile's original creator field.
  const links = await ElderlyFamilyLink.find({
    familyUserId,
    status: "active",
  }).select(
    "elderlyProfileId",
  );

  // Avoid a second query when the family has no active profile relationships.
  if (links.length === 0) {
    return false;
  }

  const linkedProfileIds = [];

  // A 'for...of' loop reads one link at a time. 'push()' appends its profile ID
  // to the array used by the next MongoDB query.
  for (const link of links) {
    linkedProfileIds.push(link.elderlyProfileId);
  }

  // Archived profiles do not satisfy onboarding or active-dashboard requirements.
  // 'exists()' asks MongoDB whether at least one matching profile exists. It is
  // lighter than loading the complete profile when only true or false is needed.
  const activeProfile = await ElderlyProfile.exists({
    _id: {
      $in: linkedProfileIds,
    },
    status: "active",
  });

  // 'Boolean()' converts the matching document information to true, or null to false.
  return Boolean(activeProfile);
}

/**
 * Loads an elderly profile only when the family has the required active permission.
 * @param {object} options - Profile, family, and access constraints.
 * @param {string} options.profileId - Requested elderly profile ID.
 * @param {string|import("mongoose").Types.ObjectId} options.familyUserId - Family user ID.
 * @param {string[]} [options.permissions] - Accepted link permissions.
 * @param {boolean} [options.includeArchived] - Whether archived profiles are allowed.
 * @returns {Promise<object>} Authorized profile and family-link documents.
 * @sideEffects Reads MongoDB; returns 404 for invalid IDs and unauthorized records to prevent disclosure.
 */
export async function getAuthorizedElderlyProfile({
  profileId,
  familyUserId,
  permissions = ["owner", "editor", "viewer"],
  includeArchived = false,
}) {
  // Invalid identifiers use the same response as missing records to avoid leaking details.
  // 'isValidObjectId()' checks the ID format before MongoDB receives the query.
  // Step 1: Reject an invalid identifier using the concealed 404 response.
  if (!mongoose.isValidObjectId(profileId)) {
    throw new ApiError(
      404,
      "Elderly profile not found.",
    );
  }

  // Step 2: Describe the required family relationship and permission.
  const linkFilter = {
    elderlyProfileId: profileId,
    familyUserId,
    permission: {
      $in: permissions,
    },
    status: "active",
  };

  // Check the relationship before loading health data so unauthorized callers learn nothing.
  // 'findOne()' returns the first matching access link or null when none exists.
  // Step 3: Verify access before reading private health information.
  const link = await ElderlyFamilyLink.findOne(linkFilter);

  if (!link) {
    throw new ApiError(
      404,
      "Elderly profile not found.",
    );
  }

  // Step 4: Build the profile query only after authorization succeeds.
  const profileFilter = {
    _id: profileId,
  };

  // Most workflows exclude archived profiles; owner-only archive views can opt in explicitly.
  if (!includeArchived) {
    profileFilter.status = "active";
  }

  // 'findOne()' returns the authorized profile document or null.
  // Step 5: Load the profile and apply the requested archive rule.
  const profile = await ElderlyProfile.findOne(profileFilter);

  if (!profile) {
    throw new ApiError(
      404,
      "Elderly profile not found.",
    );
  }

  // Step 6: Return both the profile data and the permission link.
  return {
    profile,
    link,
  };
}

/*
 * To add another elderly-profile access rule, keep relationship and permission
 * checks in this service, call it from the controller, and expose only the data
 * needed by the frontend service or hook. Use the same concealed 404 response for
 * missing and unauthorized health records so record existence is not disclosed.
 */
