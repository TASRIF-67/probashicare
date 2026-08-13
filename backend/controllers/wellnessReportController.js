import mongoose from "mongoose";
import { ElderlyFamilyLink } from "../models/ElderlyFamilyLink.js";
import { WellnessReport, WELLNESS_REPORT_STATUSES } from "../models/WellnessReport.js";
import { validateWellnessReportPayload } from "../middleware/validateWellnessReport.js";
import {
  getReportableCareAssignment,
  listReportableCareAssignments,
} from "../services/careAssignmentService.js";
import { getAuthorizedElderlyProfile } from "../services/elderlyProfileAccessService.js";
import { createNotificationsForUsers } from "../services/notificationService.js";
import { analyzeAndCreateWellnessAlerts } from "../services/wellnessAnalysisService.js";
import { ApiError } from "../utils/ApiError.js";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const MAX_TREND_DAYS = 365;

/**
 * Parses bounded positive pagination values from an Express query object.
 * @param {Record<string, unknown>} query - Request query containing optional page and limit values.
 * @returns {{page: number, limit: number, skip: number}} Normalized pagination values.
 * @sideEffects Throws a 422 ApiError when a supplied value is invalid.
 */
function parsePagination(query) {
  let page = 1;
  let limit = DEFAULT_PAGE_SIZE;

  if (query.page !== undefined) {
    page = Number(query.page);
  }

  if (query.limit !== undefined) {
    limit = Number(query.limit);
  }

  if (!Number.isInteger(page) || page < 1) {
    throw new ApiError(422, "Page must be a positive integer.");
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new ApiError(422, `Limit must be between 1 and ${MAX_PAGE_SIZE}.`);
  }

  const skip = (page - 1) * limit;

  return {
    page,
    limit,
    skip,
  };
}

/**
 * Populates caregiver and elderly identity fields used by report screens.
 * @param {import("mongoose").Query} query - Mongoose WellnessReport query.
 * @returns {import("mongoose").Query} The same query with safe identity population configured.
 * @sideEffects Configures the later MongoDB query; it does not execute it directly.
 */
function populateReportIdentity(query) {
  return query
    .populate("caregiverUserId", "name")
    .populate(
      "elderlyProfileId",
      "personalInformation.fullName personalInformation.preferredName profilePhotoUrl status",
    );
}

/**
 * Converts one populated report into the stable public API representation.
 * @param {import("../models/WellnessReport.js").WellnessReport} report - Populated report document.
 * @returns {Record<string, unknown>} Plain report fields with caregiver and elderly summaries.
 * @sideEffects None.
 */
function toWellnessReportResponse(report) {
  const value = report.toObject();
  const caregiver = value.caregiverUserId;
  const elderly = value.elderlyProfileId;

  let caregiverUserId = caregiver;
  let caregiverSummary = null;

  if (caregiver && caregiver._id) {
    caregiverUserId = caregiver._id;
    caregiverSummary = {
      id: caregiver._id,
      name: caregiver.name,
    };
  }

  let elderlyProfileId = elderly;
  let elderlySummary = null;

  if (elderly && elderly._id) {
    elderlyProfileId = elderly._id;

    let fullName;
    let preferredName;

    if (elderly.personalInformation) {
      fullName = elderly.personalInformation.fullName;
      preferredName = elderly.personalInformation.preferredName;
    }

    elderlySummary = {
      id: elderly._id,
      fullName,
      preferredName,
      profilePhotoUrl: elderly.profilePhotoUrl,
    };
  }

  return {
    ...value,
    caregiverUserId,
    elderlyProfileId,
    caregiver: caregiverSummary,
    elderly: elderlySummary,
  };
}

/**
 * Builds the pagination object returned by wellness report list endpoints.
 * @param {number} page - Current one-based page number.
 * @param {number} limit - Maximum records returned on one page.
 * @param {number} total - Total records matching the query.
 * @returns {{page: number, limit: number, total: number, pages: number}} Pagination metadata.
 * @sideEffects None.
 */
function buildPaginationResponse(page, limit, total) {
  return {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  };
}

/**
 * Notifies every actively linked family account about a submitted report.
 * @param {import("../models/WellnessReport.js").WellnessReport} report - Submitted report document.
 * @returns {Promise<void>}
 * @sideEffects Reads family links and upserts one notification per family user.
 */
async function notifyFamilyAboutSubmittedReport(report) {
  const links = await ElderlyFamilyLink.find({
    elderlyProfileId: report.elderlyProfileId,
    status: "active",
  }).select("familyUserId");

  const recipientUserIds = [];

  for (const link of links) {
    recipientUserIds.push(link.familyUserId);
  }

  if (!recipientUserIds.length) {
    return;
  }

  const profileId = report.elderlyProfileId.toString();
  const reportId = report._id.toString();

  await createNotificationsForUsers({
    recipientUserIds,
    actorUserId: report.caregiverUserId,
    type: "wellness-report-submitted",
    priority: "important",
    title: "New wellness report",
    message: "A caregiver submitted a new wellness update.",
    actionPath:
      "/elderly-profiles/" +
      profileId +
      "/wellness-reports/" +
      reportId,
    relatedEntityType: "wellness-report",
    relatedEntityId: report._id,
    eventKey: "wellness-report:" + reportId + ":submitted",
  });
}

/**
 * Loads a report by ID and verifies whether the current family or caregiver may read it.
 * @param {{reportId: string, user: import("../models/User.js").User}} input - Report ID and authenticated user.
 * @returns {Promise<import("../models/WellnessReport.js").WellnessReport>} Authorized populated report.
 * @sideEffects Reads WellnessReport and family-link data; conceals unauthorized records as 404.
 */
async function getAuthorizedReport({ reportId, user }) {
  if (!mongoose.isValidObjectId(reportId)) {
    throw new ApiError(404, "Wellness report not found.");
  }

  const report = await populateReportIdentity(WellnessReport.findById(reportId));

  if (!report) {
    throw new ApiError(404, "Wellness report not found.");
  }

  if (user.role === "caregiver") {
    if (report.caregiverUserId?._id?.toString() !== user._id.toString()) {
      throw new ApiError(404, "Wellness report not found.");
    }
    return report;
  }
  if (user.role === "family" && report.status === "submitted") {
    await getAuthorizedElderlyProfile({
      profileId: report.elderlyProfileId?._id?.toString(),
      familyUserId: user._id,
    });
    return report;
  }
  throw new ApiError(404, "Wellness report not found.");
}

/**
 * GET /api/wellness-reports/assignments
 * Body/params/query: none.
 * Success 200: `{ success: true, data: { assignments: AssignmentSummary[], count: number } }`.
 * Failure: shared 401/403 error shape for session, role, or application-state failures.
 * Auth: verified authenticated `caregiver` with an approved application.
 * @param {import("express").Request} request - Authenticated caregiver request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads reportable care assignments and active elderly profiles from MongoDB.
 */
export async function listCaregiverReportAssignments(request, response) {
  const assignments = await listReportableCareAssignments(request.user._id);
  const result = [];

  for (const assignment of assignments) {
    if (!assignment.elderlyProfileId) {
      continue;
    }

    const assignmentSummary = {
      id: assignment._id,
      elderlyProfileId: assignment.elderlyProfileId._id,
      elderly: {
        id: assignment.elderlyProfileId._id,
        fullName: assignment.elderlyProfileId.personalInformation.fullName,
        preferredName: assignment.elderlyProfileId.personalInformation.preferredName,
        profilePhotoUrl: assignment.elderlyProfileId.profilePhotoUrl,
      },
      assignmentType: assignment.assignmentType,
      startsAt: assignment.startsAt,
      endsAt: assignment.endsAt,
      status: assignment.status,
    };

    result.push(assignmentSummary);
  }

  response.json({
    success: true,
    data: {
      assignments: result,
      count: result.length,
    },
  });
}

/**
 * POST /api/wellness-reports
 * Body: `{ careAssignmentId, elderlyProfileId, visitDate, checkInAt?, checkOutAt?, mood?, mealStatus?, mealNotes?, medicineIntakeStatus?, medicineNotes?, vitals?, exerciseDurationMinutes?, observations?, caregiverNotes?, nextVisitDate? }`.
 * Success 201: `{ success: true, data: { report, message } }` with a caregiver-owned draft.
 * Failure: shared validation, concealed assignment 404, or auth error shape.
 * Auth: verified authenticated `caregiver` with an approved application and matching reportable assignment.
 * @param {import("express").Request} request - Authenticated caregiver request containing draft fields.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Validates an assignment and creates one WellnessReport draft in MongoDB.
 */
export async function createWellnessReport(request, response) {
  const values = validateWellnessReportPayload(request.body);
  await getReportableCareAssignment({
    assignmentId: values.careAssignmentId,
    caregiverUserId: request.user._id,
    elderlyProfileId: values.elderlyProfileId,
    visitDate: values.visitDate,
  });
  const created = await WellnessReport.create({
    ...values,
    caregiverUserId: request.user._id,
    status: "draft",
    submittedAt: null,
  });
  const report = await populateReportIdentity(WellnessReport.findById(created._id));
  response.status(201).json({
    success: true,
    data: { report: toWellnessReportResponse(report), message: "Wellness report draft created." },
  });
}

/**
 * PUT /api/wellness-reports/:reportId
 * Params: `{ reportId: string }`; body: complete editable wellness-report fields; query unused.
 * Success 200: `{ success: true, data: { report, message } }`.
 * Failure: shared 404 for missing/not-owned/submitted reports plus validation or assignment errors.
 * Auth: approved authenticated `caregiver`; only the reporting caregiver may update their draft.
 * @param {import("express").Request} request - Authenticated caregiver draft-update request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Validates assignment access and replaces editable draft fields in MongoDB.
 */
export async function updateWellnessReportDraft(request, response) {
  if (!mongoose.isValidObjectId(request.params.reportId)) {
    throw new ApiError(404, "Wellness report not found.");
  }
  const report = await WellnessReport.findOne({
    _id: request.params.reportId,
    caregiverUserId: request.user._id,
    status: "draft",
  });
  if (!report) {
    throw new ApiError(404, "Editable wellness report not found.");
  }

  const values = validateWellnessReportPayload(request.body);
  await getReportableCareAssignment({
    assignmentId: values.careAssignmentId,
    caregiverUserId: request.user._id,
    elderlyProfileId: values.elderlyProfileId,
    visitDate: values.visitDate,
  });
  Object.assign(report, values);
  await report.save();
  const populated = await populateReportIdentity(WellnessReport.findById(report._id));
  response.json({
    success: true,
    data: { report: toWellnessReportResponse(populated), message: "Wellness report draft saved." },
  });
}

/**
 * POST /api/wellness-reports/:reportId/submit
 * Params: `{ reportId: string }`; body/query unused because the stored draft is validated.
 * Success 200: `{ success: true, data: { report, message } }` with immutable submitted state.
 * Failure: shared 404, validation, assignment, or auth error shape.
 * Auth: approved authenticated `caregiver`; only the reporting caregiver may submit their draft.
 * @param {import("express").Request} request - Authenticated caregiver finalization request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Revalidates assignment access and marks one WellnessReport submitted in MongoDB.
 */
export async function submitWellnessReport(request, response) {
  if (!mongoose.isValidObjectId(request.params.reportId)) {
    throw new ApiError(404, "Wellness report not found.");
  }
  const report = await WellnessReport.findOne({
    _id: request.params.reportId,
    caregiverUserId: request.user._id,
    status: "draft",
  });
  if (!report) {
    throw new ApiError(404, "Editable wellness report not found.");
  }

  const values = validateWellnessReportPayload(report.toObject(), { isSubmission: true });
  await getReportableCareAssignment({
    assignmentId: values.careAssignmentId,
    caregiverUserId: request.user._id,
    elderlyProfileId: values.elderlyProfileId,
    visitDate: values.visitDate,
  });
  Object.assign(report, values, { status: "submitted", submittedAt: new Date() });
  await report.save();
  await notifyFamilyAboutSubmittedReport(report);

  try {
    await analyzeAndCreateWellnessAlerts(report.elderlyProfileId);
  } catch (analysisError) {
    // The report is already valid and submitted, so derived analysis must not undo it.
    console.error(
      "Wellness alert analysis failed after report submission:",
      analysisError.message,
    );
  }

  const populated = await populateReportIdentity(WellnessReport.findById(report._id));
  response.json({
    success: true,
    data: { report: toWellnessReportResponse(populated), message: "Wellness report submitted." },
  });
}

/**
 * GET /api/wellness-reports/mine?status=draft|submitted&page=1&limit=10
 * Query: optional status and bounded pagination; body/params unused.
 * Success 200: `{ success: true, data: { reports, pagination } }`.
 * Failure: shared 422 query-validation or authentication/application-state error shape.
 * Auth: approved authenticated `caregiver`; returns only reports created by that caregiver.
 * @param {import("express").Request} request - Authenticated caregiver list request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads and counts the caregiver's WellnessReport documents.
 */
export async function listMyWellnessReports(request, response) {
  const { page, limit, skip } = parsePagination(request.query);
  const status = request.query.status;
  if (status && !WELLNESS_REPORT_STATUSES.includes(status)) {
    throw new ApiError(422, "Status must be draft or submitted.");
  }
  const filter = {
    caregiverUserId: request.user._id,
  };

  if (status) {
    filter.status = status;
  }
  const [reports, total] = await Promise.all([
    populateReportIdentity(
      WellnessReport.find(filter).sort({ visitDate: -1, createdAt: -1 }).skip(skip).limit(limit),
    ),
    WellnessReport.countDocuments(filter),
  ]);
  response.json({
    success: true,
    data: {
      reports: reports.map(toWellnessReportResponse),
      pagination: buildPaginationResponse(page, limit, total),
    },
  });
}

/**
 * GET /api/wellness-reports/:reportId
 * Params: `{ reportId: string }`; body/query unused.
 * Success 200: `{ success: true, data: { report } }`.
 * Failure: shared concealed 404 or authentication/role error shape.
 * Auth: reporting `caregiver`, or linked `family` for a submitted report.
 * @param {import("express").Request} request - Authenticated report-detail request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads WellnessReport and, for family, ElderlyFamilyLink/Profile data.
 */
export async function getWellnessReport(request, response) {
  const report = await getAuthorizedReport({ reportId: request.params.reportId, user: request.user });
  response.json({ success: true, data: { report: toWellnessReportResponse(report) } });
}

/**
 * GET /api/wellness-reports/elderly/:profileId?page=1&limit=10
 * Params: `{ profileId: string }`; query: bounded pagination; body unused.
 * Success 200: `{ success: true, data: { reports, pagination } }` containing submitted reports only.
 * Failure: shared concealed profile 404, query-validation, or authentication error shape.
 * Auth: linked authenticated `family` with owner, editor, or viewer permission.
 * @param {import("express").Request} request - Authenticated family report-history request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads family access, elderly profile, and submitted WellnessReport data.
 */
export async function listElderlyWellnessReports(request, response) {
  const { page, limit, skip } = parsePagination(request.query);
  await getAuthorizedElderlyProfile({
    profileId: request.params.profileId,
    familyUserId: request.user._id,
  });
  const filter = { elderlyProfileId: request.params.profileId, status: "submitted" };
  const [reports, total] = await Promise.all([
    populateReportIdentity(
      WellnessReport.find(filter).sort({ visitDate: -1, submittedAt: -1 }).skip(skip).limit(limit),
    ),
    WellnessReport.countDocuments(filter),
  ]);
  response.json({
    success: true,
    data: {
      reports: reports.map(toWellnessReportResponse),
      pagination: buildPaginationResponse(page, limit, total),
    },
  });
}

/**
 * GET /api/wellness-reports/elderly/:profileId/vitals?from=<ISO>&to=<ISO>
 * Params: `{ profileId: string }`; query: optional date range limited to 365 days; body unused.
 * Success 200: `{ success: true, data: { points, from, to } }` with submitted vitals only.
 * Failure: shared concealed profile 404, date-range 422, or authentication error shape.
 * Auth: linked authenticated `family` with owner, editor, or viewer permission.
 * @param {import("express").Request} request - Authenticated family vitals-trend request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads family access, elderly profile, and submitted WellnessReport data.
 */
export async function getElderlyVitalsTrends(request, response) {
  await getAuthorizedElderlyProfile({
    profileId: request.params.profileId,
    familyUserId: request.user._id,
  });
  let to = new Date();

  if (request.query.to) {
    to = new Date(request.query.to);
  }

  let from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);

  if (request.query.from) {
    from = new Date(request.query.from);
  }
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    throw new ApiError(422, "Choose a valid vitals date range.");
  }
  if (to.getTime() - from.getTime() > MAX_TREND_DAYS * 24 * 60 * 60 * 1000) {
    throw new ApiError(422, `Vitals date range cannot exceed ${MAX_TREND_DAYS} days.`);
  }
  const reports = await WellnessReport.find({
    elderlyProfileId: request.params.profileId,
    status: "submitted",
    visitDate: { $gte: from, $lte: to },
    $or: [
      { "vitals.systolic": { $ne: null } },
      { "vitals.bloodSugar": { $ne: null } },
      { "vitals.weightKg": { $ne: null } },
    ],
  })
    .select("visitDate vitals")
    .sort({ visitDate: 1 });
  const points = [];

  for (const report of reports) {
    const vitals = report.vitals.toObject();
    const point = {
      reportId: report._id,
      visitDate: report.visitDate,
      ...vitals,
    };

    points.push(point);
  }

  response.json({
    success: true,
    data: {
      from,
      to,
      points,
    },
  });
}

/*
 * To add a similar report API, document the controller contract above the
 * function, register it in wellnessReportRoutes with the narrowest role and
 * application gates, expose it through wellnessReportService, and consume it in
 * a focused page or hook. Reuse assignment and family-link services instead of
 * duplicating authorization checks.
 */
