import mongoose from "mongoose";
import { ElderlyFamilyLink } from "../models/ElderlyFamilyLink.js";
import { ElderlyProfile } from "../models/ElderlyProfile.js";
import { validateElderlyProfilePayload } from "../middleware/validateElderlyProfile.js";
import { getAuthorizedElderlyProfile } from "../services/elderlyProfileAccessService.js";
import { ApiError } from "../utils/ApiError.js";

const EDITABLE_SECTIONS = [
  "medicalHistory",
  "allergies",
  "medications",
  "chronicDiseases",
  "emergencyContacts",
];

/**
 * Converts an authorized profile and link into the public API representation.
 * @param {import("../models/ElderlyProfile.js").ElderlyProfile} profile - Elderly profile document.
 * @param {import("../models/ElderlyFamilyLink.js").ElderlyFamilyLink} link - Current family access link.
 * @returns {Record<string, unknown>} Plain profile fields plus `familyAccess`.
 * @sideEffects None.
 */

function toProfileResponse(profile, link) {
  // 'toObject()' is a Mongoose document method. It removes Mongoose document
  // behavior and returns an ordinary JavaScript object that is safe to copy.
  const profileData = profile.toObject();

  // 'return' gives this object back to the caller. It does not send an HTTP
  // response by itself.
  return {
    // The spread copies every public profile field into the response object.
    ...profileData,
    // The link describes this caller's relationship and permission, not global profile data.
    familyAccess: {
      relationship: link.relationship,
      permission: link.permission,
    },
  };
}

/**
 * Keeps an owner's relationship label aligned with the profile's family relationship field.
 * @param {import("../models/ElderlyProfile.js").ElderlyProfile} profile - Saved elderly profile.
 * @param {import("../models/ElderlyFamilyLink.js").ElderlyFamilyLink} link - Current family access link.
 * @returns {Promise<void>} Resolves after any required owner-link update.
 * @sideEffects May update one ElderlyFamilyLink document in MongoDB.
 */
async function synchronizeOwnerRelationship(profile, link) {
  // Editors may update profile data, but their own relationship label must remain unchanged.
  if (link.permission !== "owner") {
    // A bare 'return' stops this function. Because the function is async,
    // JavaScript still represents its completion with a resolved Promise.
    return;
  }

  link.relationship = profile.personalInformation.familyRelationship;

  // 'await' pauses this function until Mongoose finishes saving the link.
  // A rejected save Promise automatically travels to Express error handling.
  await link.save();
}

/**
 * POST /api/elderly-profiles
 * Body: `{ personalInformation, medicalHistory?, allergies?, medications?, chronicDiseases?, emergencyContacts? }`.
 * Success 201: `{ success: true, data: { profile } }`.
 * Failure: standard error shape with validation details or transaction failure.
 * Auth: authenticated `family`; creator receives an active owner link.
 * @param {import("express").Request} request - Authenticated request with profile payload.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Creates ElderlyProfile and ElderlyFamilyLink in one MongoDB transaction.
 */

export async function createElderlyProfile(request, response) {
  // Validate cross-field rules before starting a database transaction.
  validateElderlyProfilePayload(request.body);

  // 'startSession()' opens a MongoDB session. The session lets the profile
  // and access-link writes run as one transaction.
  const session = await mongoose.startSession();
  let profile;
  let link;

  try {
    // The profile and its owner link must either both exist or both roll back.
    // 'withTransaction()' runs the async callback. MongoDB commits only when
    // every awaited operation succeeds; otherwise it rolls the writes back.
    await session.withTransaction(async () => {
      // The array form lets Mongoose attach this transaction session to create().
      const profileDocuments = await ElderlyProfile.create(
        [
          {
            ...request.body,
            createdBy: request.user._id,
            status: "active",
          },
        ],
        { session },
      );

      // Array index zero selects the first and only created profile.
      profile = profileDocuments[0];

      const linkDocuments = await ElderlyFamilyLink.create(
        [
          {
            elderlyProfileId: profile._id,
            familyUserId: request.user._id,
            relationship: profile.personalInformation.familyRelationship,
            permission: "owner",
            linkedBy: request.user._id,
            status: "active",
          },
        ],
        { session },
      );

      // Array index zero selects the first and only created link.
      link = linkDocuments[0];
    });
  } finally {
    // A MongoDB session must be closed whether the transaction succeeds or fails.
    await session.endSession();
  }

  const responseBody = {
    success: true,
    data: {
      profile: toProfileResponse(profile, link),
    },
  };

  // 'status(201)' selects HTTP Created. 'json()' converts responseBody to
  // JSON and completes the HTTP request.
  response.status(201);
  response.json(responseBody);
}

/**
 * GET /api/elderly-profiles?status=active|archived|all
 * Query: optional `status`, defaulting to `active`; body and params are unused.
 * Success 200: `{ success: true, data: { profiles: Profile[], count: number } }`.
 * Failure: standard error shape for invalid query values.
 * Auth: authenticated `family`; returns only profiles with the caller's active link.
 * @param {import("express").Request} request - Authenticated request with optional status query.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads ElderlyFamilyLink and ElderlyProfile collections.
 */
export async function listElderlyProfiles(request, response) {
  const status = request.query.status || "active";

  const allowedStatuses = ["active", "archived", "all"];

  // 'includes()' returns true when the array contains the supplied status.
  if (!allowedStatuses.includes(status)) {
    throw new ApiError(422, "Status must be active, archived, or all.");
  }

  // The link collection is the source of truth for which profiles this family may see.
  const links = await ElderlyFamilyLink.find({
    familyUserId: request.user._id,
    status: "active",
  })
    // 'lean()' asks Mongoose for plain objects because this function will not
    // call document methods such as save() on the returned links.
    .lean();

  const linkedProfileIds = [];

  for (const link of links) {
    // 'push()' adds one value to the end of an array.
    linkedProfileIds.push(link.elderlyProfileId);
  }

  const profileFilter = {
    _id: {
      $in: linkedProfileIds,
    },
  };

  // `all` intentionally removes the profile-status filter while retaining link authorization.
  if (status !== "all") {
    profileFilter.status = status;
  }

  // 'sort({ updatedAt: -1 })' asks MongoDB to return newest updates first.
  const profiles = await ElderlyProfile.find(profileFilter).sort({
    updatedAt: -1,
  });

  // 'Map' is a built-in key/value collection. It avoids repeatedly searching
  // the link array while profiles are converted below.
  const linksByProfile = new Map();

  for (const link of links) {
    // 'toString()' converts MongoDB's ObjectId object to comparable text.
    const profileId = link.elderlyProfileId.toString();

    // 'set()' stores the link under its profile ID key.
    linksByProfile.set(profileId, link);
  }

  const result = [];

  for (const profile of profiles) {
    // 'get()' retrieves the Map value stored under this profile ID.
    const link = linksByProfile.get(profile._id.toString());
    const profileResponse = toProfileResponse(profile, link);

    // 'push()' appends the prepared profile to the result array.
    result.push(profileResponse);
  }

  const responseBody = {
    success: true,
    data: {
      profiles: result,
      // 'length' contains the number of elements in the result array.
      count: result.length,
    },
  };

  // 'json()' converts responseBody to JSON and completes the request.
  response.json(responseBody);
}

/**
 * GET /api/elderly-profiles/:profileId
 * Params: `{ profileId: string }`; body and query are unused.
 * Success 200: `{ success: true, data: { profile } }`.
 * Failure: standard 404 shape for missing, archived, malformed, or unauthorized profiles.
 * Auth: authenticated `family` with an active owner/editor/viewer link.
 * @param {import("express").Request} request - Authenticated request containing profile ID.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads access link and elderly profile from MongoDB.
 */
export async function getElderlyProfile(request, response) {
  // The access service returns 404 for missing and unauthorized profiles to avoid disclosure.
  const { profile, link } = await getAuthorizedElderlyProfile({
    profileId: request.params.profileId,
    familyUserId: request.user._id,
  });

  response.json({
    success: true,
    data: {
      profile: toProfileResponse(profile, link),
    },
  });
}

/**
 * PUT /api/elderly-profiles/:profileId
 * Params: `{ profileId: string }`; body: complete editable profile payload; query is unused.
 * Success 200: `{ success: true, data: { profile } }`.
 * Failure: standard validation or concealed 404 error shape.
 * Auth: authenticated `family` with owner or editor permission.
 * @param {import("express").Request} request - Authenticated full-profile replacement request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Replaces all editable profile sections and synchronizes an owner's relationship.
 */
export async function updateElderlyProfile(request, response) {
  // A full update must pass validation for personal information and every supplied section.
  validateElderlyProfilePayload(request.body);

  // View-only family links cannot modify the profile.
  const { profile, link } = await getAuthorizedElderlyProfile({
    profileId: request.params.profileId,
    familyUserId: request.user._id,
    permissions: ["owner", "editor"],
  });

  profile.personalInformation = request.body.personalInformation;

  for (const section of EDITABLE_SECTIONS) {
    // Omitted array sections become empty during a complete profile replacement.
    profile[section] = request.body[section] || [];
  }

  await profile.save();
  await synchronizeOwnerRelationship(profile, link);

  response.json({
    success: true,
    data: {
      profile: toProfileResponse(profile, link),
    },
  });
}

/**
 * PATCH /api/elderly-profiles/:profileId/personal-information
 * Params: `{ profileId: string }`; body: complete `{ personalInformation }`.
 * Success 200: `{ success: true, data: { profile } }`.
 * Failure: standard validation or concealed 404 error shape.
 * Auth: authenticated `family` with owner or editor permission.
 * @param {import("express").Request} request - Authenticated personal-information update.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Updates the ElderlyProfile and synchronizes the owner's relationship on its link.
 */
export async function updatePersonalInformation(request, response) {
  // Reuse the same validation rules while allowing medical arrays to be omitted.
  validateElderlyProfilePayload({
    personalInformation: request.body.personalInformation,
  });

  const { profile, link } = await getAuthorizedElderlyProfile({
    profileId: request.params.profileId,
    familyUserId: request.user._id,
    permissions: ["owner", "editor"],
  });

  profile.personalInformation = request.body.personalInformation;
  await profile.save();
  await synchronizeOwnerRelationship(profile, link);

  response.json({
    success: true,
    data: {
      profile: toProfileResponse(profile, link),
    },
  });
}

/**
 * PUT /api/elderly-profiles/:profileId/:section
 * Params: `{ profileId: string, section: medicalHistory|allergies|medications|chronicDiseases|emergencyContacts }`;
 * body: `{ items: object[] }`; query is unused.
 * Success 200: `{ success: true, data: { profile } }`.
 * Failure: standard validation, invalid-section, or concealed 404 error shape.
 * Auth: authenticated `family` with owner or editor permission.
 * @param {import("express").Request} request - Authenticated section replacement request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Replaces one embedded medical/contact section in MongoDB.
 */
export async function updateProfileSection(request, response) {
  const { section } = request.params;

  // Restrict dynamic property access to the known editable section names.
  // 'includes()' confirms that user-controlled route text exactly matches a
  // section that this controller allows.
  if (!EDITABLE_SECTIONS.includes(section)) {
    throw new ApiError(404, "Profile section not found.");
  }

  validateElderlyProfilePayload(
    {
      [section]: request.body.items,
    },
    {
      requirePersonalInformation: false,
    },
  );

  const { profile, link } = await getAuthorizedElderlyProfile({
    profileId: request.params.profileId,
    familyUserId: request.user._id,
    permissions: ["owner", "editor"],
  });

  // Validation above makes this computed assignment safe and guarantees an array value.
  profile[section] = request.body.items;
  await profile.save();

  response.json({
    success: true,
    data: {
      profile: toProfileResponse(profile, link),
    },
  });
}

/**
 * PATCH /api/elderly-profiles/:profileId/archive
 * Params: `{ profileId: string }`; body and query are unused.
 * Success 200: `{ success: true, data: { profile } }`.
 * Failure: standard concealed 404 error shape.
 * Auth: authenticated `family` with owner permission only.
 * @param {import("express").Request} request - Authenticated owner request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Marks the ElderlyProfile archived and records the archive time.
 */
export async function archiveElderlyProfile(request, response) {
  // Archiving is owner-only because it removes the profile from active family workflows.
  const { profile, link } = await getAuthorizedElderlyProfile({
    profileId: request.params.profileId,
    familyUserId: request.user._id,
    permissions: ["owner"],
  });

  profile.status = "archived";

  // 'new Date()' creates a Date object containing the current time.
  profile.archivedAt = new Date();
  await profile.save();

  response.json({
    success: true,
    data: {
      profile: toProfileResponse(profile, link),
    },
  });
}
