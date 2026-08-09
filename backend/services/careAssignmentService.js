import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { CareAssignment } from "../models/CareAssignment.js";
import { ElderlyProfile } from "../models/ElderlyProfile.js";
import { ApiError } from "../utils/ApiError.js";

const REPORTABLE_STATUSES = ["scheduled", "active", "completed"];
const REPORTABLE_BOOKING_STATUSES = ["accepted", "confirmed", "completed"];

/**
 * Creates missing assignment projections for bookings accepted before integration.
 * @param {string|import("mongoose").Types.ObjectId} caregiverUserId - Caregiver User ID.
 * @returns {Promise<void>}
 * @sideEffects Reads reportable bookings and upserts their CareAssignment documents.
 */
async function synchronizeExistingCaregiverBookings(caregiverUserId) {
  const bookings = await Booking.find({
    caregiverId: caregiverUserId,
    elderlyProfileId: {
      $ne: null,
    },
    status: {
      $in: REPORTABLE_BOOKING_STATUSES,
    },
  });

  for (const booking of bookings) {
    let assignmentStatus = "scheduled";

    if (booking.status === "completed") {
      assignmentStatus = "completed";
    }

    await syncCareAssignmentFromBooking({
      bookingId: booking._id,
      elderlyProfileId: booking.elderlyProfileId,
      caregiverUserId: booking.caregiverId,
      assignmentType: booking.bookingType,
      startsAt: booking.startDate,
      endsAt: booking.endDate,
      status: assignmentStatus,
    });
  }
}

/**
 * Synchronizes the access projection for one booking without duplicating booking business data.
 * @param {{bookingId: string|import("mongoose").Types.ObjectId, elderlyProfileId: string|import("mongoose").Types.ObjectId, caregiverUserId: string|import("mongoose").Types.ObjectId, assignmentType: "one-time"|"scheduled"|"long-term", startsAt: string|Date, endsAt?: string|Date|null, status: "scheduled"|"active"|"completed"|"cancelled", session?: import("mongoose").ClientSession}} input - Booking-owned assignment state and optional transaction.
 * @returns {Promise<import("../models/CareAssignment.js").CareAssignment>} Created or updated access projection.
 * @sideEffects Upserts one CareAssignment document in MongoDB.
 */
export async function syncCareAssignmentFromBooking(input) {
  const assignmentFilter = {
    sourceBookingId: input.bookingId,
  };

  const assignmentValues = {
    elderlyProfileId: input.elderlyProfileId,
    caregiverUserId: input.caregiverUserId,
    sourceBookingId: input.bookingId,
    assignmentType: input.assignmentType,
    startsAt: input.startsAt,
    endsAt: input.endsAt || null,
    status: input.status,
  };

  // `upsert` updates an existing assignment or creates one when none exists.
  const updateOptions = {
    upsert: true,
    new: true,
    runValidators: true,
    setDefaultsOnInsert: true,
  };

  if (input.session) {
    // Using the same session keeps booking and assignment changes in one transaction.
    updateOptions.session = input.session;
  }

  return CareAssignment.findOneAndUpdate(
    assignmentFilter,
    assignmentValues,
    updateOptions,
  );
}

/**
 * Lists assignments for which an approved caregiver can prepare a wellness report.
 * @param {string|import("mongoose").Types.ObjectId} caregiverUserId - Authenticated caregiver User ID.
 * @returns {Promise<object[]>} Assignment documents populated with active elderly identity fields.
 * @sideEffects Reads CareAssignment and ElderlyProfile data from MongoDB.
 */
export async function listReportableCareAssignments(caregiverUserId) {
  // This also repairs accepted bookings created before assignment synchronization existed.
  await synchronizeExistingCaregiverBookings(caregiverUserId);

  const assignmentFilter = {
    caregiverUserId,
    status: {
      $in: REPORTABLE_STATUSES,
    },
  };

  const assignments = await CareAssignment.find(assignmentFilter)
    .sort({ startsAt: -1 })
    .populate({
      path: "elderlyProfileId",
      match: { status: "active" },
      select: "personalInformation.fullName personalInformation.preferredName profilePhotoUrl status",
    });

  return assignments;
}

/**
 * Loads a reportable assignment and verifies caregiver and elderly-profile ownership.
 * @param {{assignmentId: string, caregiverUserId: string|import("mongoose").Types.ObjectId, elderlyProfileId: string, visitDate?: string|Date}} input - Assignment and report identity.
 * @returns {Promise<import("../models/CareAssignment.js").CareAssignment>} Authorized assignment document.
 * @sideEffects Reads CareAssignment and ElderlyProfile from MongoDB; throws a concealed 404 on failure.
 */
export async function getReportableCareAssignment({
  assignmentId,
  caregiverUserId,
  elderlyProfileId,
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
  if (!assignment) {
    throw new ApiError(404, "Care assignment not found.");
  }

  const profileFilter = {
    _id: elderlyProfileId,
    status: "active",
  };
  const profileExists = await ElderlyProfile.exists(profileFilter);

  if (!profileExists) {
    throw new ApiError(404, "Care assignment not found.");
  }

  return assignment;
}

/*
 * Booking status changes call syncCareAssignmentFromBooking immediately. The
 * list operation also repairs older accepted bookings that predate integration.
 * Other care modules should use this service instead of duplicating assignment
 * authorization rules.
 */
