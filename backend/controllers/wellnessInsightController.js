import { WellnessAlert } from "../models/WellnessAlert.js";
import { getAuthorizedElderlyProfile } from "../services/elderlyProfileAccessService.js";
import {
  generateWellnessInsight,
  getLatestWellnessInsight,
} from "../services/wellnessInsightService.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Loads an alert only after verifying the family link to its elderly profile.
 * @param {string} alertId - WellnessAlert identifier.
 * @param {string|import("mongoose").Types.ObjectId} familyUserId - Family user ID.
 * @returns {Promise<import("../models/WellnessAlert.js").WellnessAlert>} Authorized alert.
 * @sideEffects Reads WellnessAlert, ElderlyFamilyLink, and ElderlyProfile.
 */
async function getAuthorizedAlert(alertId, familyUserId) {
  const alert = await WellnessAlert.findById(alertId)
    .populate("sourceReportIds", "visitDate submittedAt");

  if (!alert) {
    throw new ApiError(404, "Wellness alert not found.");
  }

  await getAuthorizedElderlyProfile({
    profileId: alert.elderlyProfileId.toString(),
    familyUserId,
  });

  return alert;
}

/**
 * GET /api/elderly-profiles/:profileId/wellness-alerts
 * Auth: authenticated family linked as owner, editor, or viewer.
 * Params: profileId; query: optional status, severity, category, page, and limit.
 * Success 200: alerts, count, activeCount, and severitySummary.
 * Failure: 404 for inaccessible profiles; 422 for invalid filters.
 * @param {import("express").Request} request - Authorized family list request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads access records and WellnessAlert documents.
 */
export async function listWellnessAlerts(request, response) {
  const page = Number(request.query.page || 1);
  const limit = Number(request.query.limit || 3);

  if (!Number.isInteger(page) || page < 1) {
    throw new ApiError(422, "Page must be a positive integer.");
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new ApiError(422, "Limit must be between 1 and 50.");
  }
  await getAuthorizedElderlyProfile({
    profileId: request.params.profileId,
    familyUserId: request.user._id,
  });

  const filter = {
    elderlyProfileId: request.params.profileId,
  };

  for (const name of ["status", "severity", "category"]) {
    if (request.query[name]) {
      filter[name] = request.query[name];
    }
  }

  const results = await Promise.all([
    WellnessAlert.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("sourceReportIds", "visitDate submittedAt"),
    WellnessAlert.countDocuments(filter),
  ]);
  const alerts = results[0];
  const total = results[1];  const allActiveAlerts = await WellnessAlert.find({
    elderlyProfileId: request.params.profileId,
    status: {
      $ne: "resolved",
    },
  }).select("severity");
  const severitySummary = {
    low: 0,
    medium: 0,
    high: 0,
  };

  for (const alert of allActiveAlerts) {
    severitySummary[alert.severity] += 1;
  }

  response.json({
    success: true,
    data: {
      alerts,
      count: alerts.length,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      activeCount: allActiveAlerts.length,
      severitySummary,
    },
  });
}

/**
 * GET /api/wellness-alerts/:alertId
 * Auth: authenticated family linked to the alert's elderly profile.
 * Success 200: one populated alert.
 * Failure: concealed 404 for missing or unauthorized alerts.
 * @param {import("express").Request} request - Family detail request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads alert and family access records.
 */
export async function getWellnessAlert(request, response) {
  const alert = await getAuthorizedAlert(
    request.params.alertId,
    request.user._id,
  );

  response.json({
    success: true,
    data: {
      alert,
    },
  });
}

/**
 * PATCH /api/wellness-alerts/:alertId/acknowledge
 * Auth: authenticated linked family user.
 * Body/query: unused; params: alertId.
 * Success 200: acknowledged alert and message.
 * Failure: concealed 404 or 409 when no longer active.
 * @param {import("express").Request} request - Family acknowledgment request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Atomically updates one active WellnessAlert.
 */
export async function acknowledgeWellnessAlert(request, response) {
  await getAuthorizedAlert(request.params.alertId, request.user._id);

  const alert = await WellnessAlert.findOneAndUpdate(
    {
      _id: request.params.alertId,
      status: "active",
    },
    {
      $set: {
        status: "acknowledged",
        acknowledgedBy: request.user._id,
        acknowledgedAt: new Date(),
      },
    },
    {
      new: true,
    },
  ).populate("sourceReportIds", "visitDate submittedAt");

  if (!alert) {
    throw new ApiError(409, "Only an active alert can be acknowledged.");
  }

  response.json({
    success: true,
    data: {
      alert,
      message: "Wellness alert acknowledged.",
    },
  });
}

/**
 * PATCH /api/wellness-alerts/:alertId/resolve
 * Auth: authenticated linked family user.
 * Body: required resolutionNote; params: alertId.
 * Success 200: resolved alert and message.
 * Failure: concealed 404, validation 422, or 409 if already resolved.
 * @param {import("express").Request} request - Family resolution request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Atomically resolves one active or acknowledged WellnessAlert.
 */
export async function resolveWellnessAlert(request, response) {
  await getAuthorizedAlert(request.params.alertId, request.user._id);

  const alert = await WellnessAlert.findOneAndUpdate(
    {
      _id: request.params.alertId,
      status: {
        $in: ["active", "acknowledged"],
      },
    },
    {
      $set: {
        status: "resolved",
        resolvedBy: request.user._id,
        resolvedAt: new Date(),
        resolutionNote: request.body.resolutionNote,
      },
    },
    {
      new: true,
    },
  ).populate("sourceReportIds", "visitDate submittedAt");

  if (!alert) {
    throw new ApiError(409, "This wellness alert is already resolved.");
  }

  response.json({
    success: true,
    data: {
      alert,
      message: "Wellness alert resolved.",
    },
  });
}

/**
 * GET /api/elderly-profiles/:profileId/wellness-insights/latest
 * Auth: authenticated linked family user.
 * Success 200: latest saved insight or null.
 * Failure: concealed 404 for inaccessible profiles.
 * @param {import("express").Request} request - Family latest-insight request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads family access and WellnessInsight records.
 */
export async function getLatestInsight(request, response) {
  await getAuthorizedElderlyProfile({
    profileId: request.params.profileId,
    familyUserId: request.user._id,
  });
  const insight = await getLatestWellnessInsight(request.params.profileId);

  response.json({
    success: true,
    data: {
      insight,
    },
  });
}

/**
 * POST /api/elderly-profiles/:profileId/wellness-insights/generate
 * Auth: authenticated linked family user.
 * Body/query: unused; params: profileId.
 * Success 200: cached or newly saved insight, provider, and reuse flag.
 * Failure: concealed 404 or 422 when no submitted reports exist.
 * External calls: may send strictly anonymized values to Gemini.
 * @param {import("express").Request} request - Family generation request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads reports, may call Gemini, and may create WellnessInsight.
 */
export async function generateInsight(request, response) {
  await getAuthorizedElderlyProfile({
    profileId: request.params.profileId,
    familyUserId: request.user._id,
  });
  const result = await generateWellnessInsight(request.params.profileId);

  if (!result.insight) {
    throw new ApiError(422, "A submitted wellness report is required.");
  }

  response.json({
    success: true,
    data: {
      insight: result.insight,
      generatedBy: result.insight.generatedBy,
      reused: result.reused,
    },
  });
}

/*
 * Add related endpoints through a documented controller, a narrowly authorized
 * route, a frontend service method, and a focused component. Reuse the elderly
 * access service instead of copying family-link authorization.
 */
