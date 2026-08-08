import mongoose from "mongoose";
import { CareAssignment } from "../models/CareAssignment.js";
import { ElderlyProfile } from "../models/ElderlyProfile.js";
import { ApiError } from "../utils/ApiError.js";

const REPORTABLE_STATUSES = ["scheduled", "active", "completed"];
const REPORT_GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Synchronizes the access projection for one booking without duplicating booking business data.
 * @param {{bookingId: string|import("mongoose").Types.ObjectId, elderlyProfileId: string|import("mongoose").Types.ObjectId, caregiverUserId: string|import("mongoose").Types.ObjectId, assignmentType: "one-time"|"scheduled"|"long-term", startsAt: string|Date, endsAt?: string|Date|null, status: "scheduled"|"active"|"completed"|"cancelled"}} input - Booking-owned assignment state.
 * @returns {Promise<import("../models/CareAssignment.js").CareAssignment>} Created or updated access projection.
 * @sideEffects Upserts one CareAssignment document in MongoDB.
 */
export async function syncCareAssignmentFromBooking(input) {
  return CareAssignment.findOneAndUpdate(
    { sourceBookingId: input.bookingId },
    {
      elderlyProfileId: input.elderlyProfileId,
      caregiverUserId: input.caregiverUserId,
      sourceBookingId: input.bookingId,
      assignmentType: input.assignmentType,
      startsAt: input.startsAt,
      endsAt: input.endsAt || null,
      status: input.status,
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );
}

/**
 * Lists assignments for which an approved caregiver can still prepare a wellness report.
 * @param {string|import("mongoose").Types.ObjectId} caregiverUserId - Authenticated caregiver User ID.
 * @returns {Promise<object[]>} Assignment documents populated with active elderly identity fields.
 * @sideEffects Reads CareAssignment and ElderlyProfile data from MongoDB.
 */
export async function listReportableCareAssignments(caregiverUserId) {
  const oldestAllowedEnd = new Date(Date.now() - REPORT_GRACE_PERIOD_MS);
  return CareAssignment.find({
    caregiverUserId,
    status: { $in: REPORTABLE_STATUSES },
    $or: [{ endsAt: null }, { endsAt: { $gte: oldestAllowedEnd } }],
  })
    .sort({ startsAt: -1 })
    .populate({
      path: "elderlyProfileId",
      match: { status: "active" },
      select: "personalInformation.fullName personalInformation.preferredName profilePhotoUrl status",
    });
}

/**
 * Loads a reportable assignment and verifies caregiver, elderly profile, and visit-date alignment.
 * @param {{assignmentId: string, caregiverUserId: string|import("mongoose").Types.ObjectId, elderlyProfileId: string, visitDate: string|Date}} input - Assignment and report identity.
 * @returns {Promise<import("../models/CareAssignment.js").CareAssignment>} Authorized assignment document.
 * @sideEffects Reads CareAssignment and ElderlyProfile from MongoDB; throws a concealed 404 or 403 on failure.
 */
export async function getReportableCareAssignment({
  assignmentId,
  caregiverUserId,
  elderlyProfileId,
  visitDate,
}) {
  if (!mongoose.isValidObjectId(assignmentId) || !mongoose.isValidObjectId(elderlyProfileId)) {
    throw new ApiError(404, "Care assignment not found.");
  }

  const assignment = await CareAssignment.findOne({
    _id: assignmentId,
    elderlyProfileId,
    caregiverUserId,
    status: { $in: REPORTABLE_STATUSES },
  });
  if (!assignment) throw new ApiError(404, "Care assignment not found.");

  const profileExists = await ElderlyProfile.exists({ _id: elderlyProfileId, status: "active" });
  if (!profileExists) throw new ApiError(404, "Care assignment not found.");

  const visitTime = new Date(visitDate).getTime();
  const startsAt = assignment.startsAt.getTime();
  const latestAllowed = assignment.endsAt
    ? assignment.endsAt.getTime() + REPORT_GRACE_PERIOD_MS
    : Number.POSITIVE_INFINITY;
  const earliestAllowed = startsAt - 24 * 60 * 60 * 1000;
  if (!Number.isFinite(visitTime) || visitTime < earliestAllowed || visitTime > latestAllowed) {
    throw new ApiError(403, "The report date falls outside this care assignment.");
  }

  return assignment;
}

/*
 * To integrate Caregiver Booking, call syncCareAssignmentFromBooking after every
 * booking state change. Other care modules should depend on this service instead
 * of importing the future Booking model, keeping assignment authorization in one
 * place when booking types or statuses evolve.
 */
