import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { BookingReservation } from "../models/BookingReservation.js";
import { FamilyBookingReservation } from "../models/FamilyBookingReservation.js";
import { syncCareAssignmentFromBooking } from "../services/careAssignmentService.js";
import { createNotification } from "../services/notificationService.js";
import { ApiError } from "../utils/ApiError.js";
import { buildReservationDocuments, dateKey, parseTimeSlot } from "../utils/bookingSchedule.js";
import { CaregiverReview } from "../models/CaregiverReview.js";
import { CaregiverComplaint } from "../models/CaregiverComplaint.js";
import { env } from "../config/env.js";

/**
 * Converts one populated booking into the shared participant response shape.
 * Optional family-only feedback records are omitted from caregiver responses.
 * @param {import("mongoose").Document} booking - Populated booking document.
 * @param {object|null} [review=null] - Family-owned review summary.
 * @param {object|null} [complaint=null] - Family-owned complaint summary.
 * @returns {object} Safe booking response with participant names and schedule.
 * @sideEffects None.
 */
function formatBooking(booking, review = null, complaint = null) {
  const caregiver = booking.caregiverId?._id
    ? booking.caregiverId
    : null;
  const family = booking.familyMemberId?._id
    ? booking.familyMemberId
    : null;
  const elderly = booking.elderlyProfileId?.personalInformation
    ? booking.elderlyProfileId
    : null;
  let elderlyName = "";

  if (elderly) {
    elderlyName = elderly.personalInformation.preferredName
      || elderly.personalInformation.fullName;
  }

  return {
    _id: booking._id,
    caregiverId: caregiver?._id?.toString()
      || booking.caregiverId?.toString(),
    elderlyProfileId: elderly?._id?.toString()
      || booking.elderlyProfileId?.toString(),
    caregiver: caregiver
      ? {
          id: caregiver._id.toString(),
          name: caregiver.name,
        }
      : null,
    familyMember: family
      ? {
          id: family._id.toString(),
          name: family.name,
        }
      : null,
    elderlyProfile: elderly
      ? {
          id: elderly._id.toString(),
          name: elderlyName,
        }
      : null,
    bookingType: booking.bookingType,
    serviceType: booking.serviceType,
    startDate: booking.startDate,
    endDate: booking.endDate,
    slots: booking.slots || [],
    occurrences: booking.occurrences || [],
    status: booking.status,
    statusReason: booking.statusReason || "",
    completedAt: booking.completedAt || null,
    review,
    complaint,
    migrationStatus: booking.migrationStatus || "requires-review",
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}

/**
 * Adds participant display fields to a Booking query without exposing emails.
 * Mongoose populate replaces stored IDs with selected referenced documents.
 * @param {import("mongoose").Query} query - Booking query to populate.
 * @returns {import("mongoose").Query} The same query with population rules.
 * @sideEffects Configures the supplied Mongoose query before execution.
 */
function populateBooking(query) {
  return query
    .populate("caregiverId", "name role")
    .populate("familyMemberId", "name role")
    .populate(
      "elderlyProfileId",
      "personalInformation.fullName personalInformation.preferredName",
    );
}

/**
 * Converts a booking workflow status into a care-assignment status.
 * @param {string} bookingStatus - Current booking status.
 * @returns {"scheduled"|"completed"|"cancelled"} Matching assignment status.
 * @sideEffects None.
 */
function getAssignmentStatus(bookingStatus) {
  if (bookingStatus === "completed") {
    return "completed";
  }

  if (bookingStatus === "accepted" || bookingStatus === "confirmed") {
    return "scheduled";
  }

  return "cancelled";
}

/**
 * Creates or updates the wellness-report assignment linked to a booking.
 * @param {import("../models/Booking.js").Booking} booking - Updated booking document.
 * @param {import("mongoose").ClientSession} session - Active booking transaction.
 * @returns {Promise<void>}
 * @sideEffects Upserts one CareAssignment in the same MongoDB transaction.
 */
async function synchronizeBookingAssignment(booking, session) {
  // Legacy bookings without an elderly profile cannot authorize health reports.
  if (!booking.elderlyProfileId) {
    return;
  }

  await syncCareAssignmentFromBooking({
    bookingId: booking._id,
    elderlyProfileId: booking.elderlyProfileId,
    caregiverUserId: booking.caregiverId,
    assignmentType: booking.bookingType,
    startsAt: booking.startDate,
    endsAt: booking.endDate,
    status: getAssignmentStatus(booking.status),
    session,
  });
}

/**
 * Creates a booking notification inside the active booking transaction.
 * @param {object} input - Booking event notification details.
 * @param {import("../models/Booking.js").Booking} input.booking - Booking event.
 * @param {string|import("mongoose").Types.ObjectId} input.recipientUserId - Recipient.
 * @param {string|import("mongoose").Types.ObjectId} input.actorUserId - Actor.
 * @param {string} input.type - Stable notification type.
 * @param {string} input.title - Short notification title.
 * @param {string} input.message - Readable notification message.
 * @param {string} input.actionPath - Related frontend route.
 * @param {import("mongoose").ClientSession} input.session - Active transaction.
 * @returns {Promise<void>}
 * @sideEffects Upserts one Notification in the booking transaction.
 */
async function createBookingNotification(input) {
  await createNotification({
    recipientUserId: input.recipientUserId,
    actorUserId: input.actorUserId,
    type: input.type,
    priority: "important",
    title: input.title,
    message: input.message,
    actionPath: input.actionPath,
    relatedEntityType: "booking",
    relatedEntityId: input.booking._id,
    eventKey: "booking:" + input.booking._id + ":" + input.type,
    session: input.session,
  });
}

/**
 * POST /api/bookings
 * Auth: authenticated Family account with the required booking entitlement.
 * Body: validated caregiver, elderly profile, service, dates, and time slots.
 * Success 201: newly created booking with safe participant fields.
 * Failure 409: the family or caregiver is already reserved on a chosen date.
 * Transaction: booking, reservations, and caregiver notification either all
 * succeed or all roll back together.
 * @param {import("express").Request} request - Validated Family request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>} Resolves after returning the booking.
 * @sideEffects Creates booking, reservation, and notification records.
 */
export async function createBooking(request, response) {
  const input = request.bookingInput;
  const session = await mongoose.startSession();
  let bookingId;

  try {
    // withTransaction commits every write together and rolls all of them back
    // when any write throws.
    await session.withTransaction(async () => {
      const selectedDates = [];

      for (const occurrence of input.occurrences) {
        selectedDates.push(occurrence.date);
      }

      // This caller-owned query covers active legacy bookings. The $in
      // operator matches any selected date. Unique indexes still protect
      // simultaneous requests.
      const existingFamilyBooking = await Booking.exists({
        familyMemberId: request.user._id,
        status: {
          $in: ["pending", "accepted", "confirmed"],
        },
        "occurrences.date": {
          $in: selectedDates,
        },
      }).session(session);

      if (existingFamilyBooking) {
        throw new ApiError(
          409,
          "You already have booked care on one or more selected dates. Choose another schedule.",
        );
      }

      const bookingInput = {
        familyMemberId: request.user._id,
        caregiverId: input.caregiverId,
        elderlyProfileId: input.elderlyProfileId,
        bookingType: input.bookingType,
        serviceType: input.serviceType,
        startDate: input.startDate,
        endDate: input.endDate,
        timeSlot: input.occurrences[0].timeSlot,
        slots: input.slots,
        occurrences: input.occurrences,
        status: "pending",
        schemaVersion: 2,
        migrationStatus: "current",
      };

      // Mongoose create receives an array when a session is supplied, so it
      // returns an array containing the new document.
      const createdBookings = await Booking.create([bookingInput], {
        session,
      });
      const booking = createdBookings[0];
      bookingId = booking._id;

      const reservationInput = {
        bookingId,
        caregiverId: input.caregiverId,
        occurrences: input.occurrences,
      };
      const reservations = buildReservationDocuments(reservationInput);

      // insertMany efficiently writes every occurrence reservation. ordered
      // stops at the first conflict so the transaction can roll back.
      await BookingReservation.insertMany(reservations, {
        ordered: true,
        session,
      });

      const familyDateReservations = [];

      for (const occurrence of input.occurrences) {
        familyDateReservations.push({
          bookingId,
          familyMemberId: request.user._id,
          occurrenceDate: occurrence.date,
        });
      }

      await FamilyBookingReservation.insertMany(familyDateReservations, {
        ordered: true,
        session,
      });

      await createBookingNotification({
        booking,
        recipientUserId: booking.caregiverId,
        actorUserId: booking.familyMemberId,
        type: "booking-requested",
        title: "New booking request",
        message: "A family requested a new care schedule.",
        actionPath: "/caregiver/bookings",
        session,
      });
    });
  } catch (error) {
    let isDuplicateKeyError = error?.code === 11000;

    // Bulk MongoDB failures may place the duplicate code in writeErrors.
    if (!isDuplicateKeyError && error?.writeErrors) {
      for (const writeError of error.writeErrors) {
        if (writeError.code === 11000) {
          isDuplicateKeyError = true;
          break;
        }
      }
    }

    if (isDuplicateKeyError) {
      throw new ApiError(
        409,
        "You or this caregiver already have a booking on one or more selected dates. Choose another schedule.",
      );
    }

    throw error;
  } finally {
    await session.endSession();
  }

  const bookingQuery = Booking.findById(bookingId);
  const populatedBooking = await populateBooking(bookingQuery);

  response.status(201).json({
    success: true,
    data: {
      message: "Booking request created successfully.",
      booking: formatBooking(populatedBooking),
    },
  });
}

/**
 * GET /api/bookings and GET /api/bookings/my-bookings
 * Auth: authenticated Family account.
 * Success 200: caller-owned bookings plus that family's review/complaint.
 * Permission: familyMemberId always comes from request.user._id.
 * @param {import("express").Request} request - Family list request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>} Resolves after returning the list.
 * @sideEffects Reads bookings, reviews, and complaints.
 */
export async function listMyBookings(request, response) {
  const ownershipFilter = {
    familyMemberId: request.user._id,
  };
  const bookingQuery = Booking.find(ownershipFilter).sort({
    createdAt: -1,
  });
  const bookings = await populateBooking(bookingQuery);
  const bookingIds = [];

  for (const booking of bookings) {
    bookingIds.push(booking._id);
  }

  // Promise.all starts both independent caller-owned queries together.
  const feedbackResults = await Promise.all([
    CaregiverReview.find({
      familyMemberId: request.user._id,
      bookingId: {
        $in: bookingIds,
      },
    }),
    CaregiverComplaint.find({
      familyMemberId: request.user._id,
      bookingId: {
        $in: bookingIds,
      },
    }),
  ]);
  const reviews = feedbackResults[0];
  const complaints = feedbackResults[1];
  const reviewsByBookingId = {};
  const complaintsByBookingId = {};

  for (const review of reviews) {
    const reviewBookingId = review.bookingId.toString();

    reviewsByBookingId[reviewBookingId] = {
      id: review._id.toString(),
      rating: review.rating,
      feedback: review.feedback || "",
      moderationStatus: review.moderationStatus,
      createdAt: review.createdAt,
    };
  }

  for (const complaint of complaints) {
    const complaintBookingId = complaint.bookingId.toString();

    complaintsByBookingId[complaintBookingId] = {
      id: complaint._id.toString(),
      category: complaint.category,
      description: complaint.description,
      status: complaint.status,
      adminResponse: complaint.adminResponse || "",
      createdAt: complaint.createdAt,
      resolvedAt: complaint.resolvedAt || null,
    };
  }

  const formattedBookings = [];

  for (const booking of bookings) {
    const bookingIdText = booking._id.toString();
    const review = reviewsByBookingId[bookingIdText] || null;
    const complaint = complaintsByBookingId[bookingIdText] || null;

    formattedBookings.push(formatBooking(booking, review, complaint));
  }

  response.json({
    success: true,
    data: {
      count: formattedBookings.length,
      bookings: formattedBookings,
    },
  });
}

/**
 * PATCH /api/bookings/:bookingId/cancel
 * Auth: authenticated Family account that owns the booking.
 * Success 200: cancelled booking. Failure 404: malformed ID. Failure 409:
 * missing, other-family, terminal, or fully past booking.
 * Transaction: status, reservations, assignment, and caregiver notification
 * are changed together.
 * @param {import("express").Request} request - Family cancellation request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>} Resolves after returning the cancellation.
 * @sideEffects Updates booking-related records and creates a notification.
 */
export async function cancelMyBooking(request, response) {
  const bookingId = request.params.bookingId;

  if (!mongoose.isValidObjectId(bookingId)) {
    throw new ApiError(404, "Booking not found.");
  }

  const now = new Date();
  const today = new Date(
    Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ),
  );
  const cancellationReason = String(
    request.body?.reason || "Cancelled by family",
  ).slice(0, 500);
  const session = await mongoose.startSession();
  let booking;

  try {
    await session.withTransaction(async () => {
      const cancellableBookingFilter = {
        _id: bookingId,
        familyMemberId: request.user._id,
        status: {
          $in: ["pending", "accepted", "confirmed"],
        },
        occurrences: {
          $elemMatch: {
            date: {
              $gte: today,
            },
          },
        },
      };
      const cancellationUpdate = {
        $set: {
          status: "cancelled",
          statusReason: cancellationReason,
          cancelledAt: now,
        },
      };

      // This atomic query combines ownership, allowed status, date, and update.
      // new: true returns the updated document.
      booking = await Booking.findOneAndUpdate(
        cancellableBookingFilter,
        cancellationUpdate,
        {
          new: true,
          session,
        },
      );

      if (!booking) {
        return;
      }

      await BookingReservation.deleteMany({
        bookingId: booking._id,
      }).session(session);
      await FamilyBookingReservation.deleteMany({
        bookingId: booking._id,
      }).session(session);
      await synchronizeBookingAssignment(booking, session);
      await createBookingNotification({
        booking,
        recipientUserId: booking.caregiverId,
        actorUserId: booking.familyMemberId,
        type: "booking-cancelled",
        title: "Booking cancelled",
        message: "A family cancelled a care booking.",
        actionPath: "/caregiver/bookings",
        session,
      });
    });
  } finally {
    await session.endSession();
  }

  if (!booking) {
    throw new ApiError(409, "This booking cannot be cancelled.");
  }

  response.json({
    success: true,
    data: {
      message: "Booking cancelled.",
      booking: formatBooking(booking),
    },
  });
}

/**
 * GET /api/caregiver/bookings/mine
 * Auth: authenticated caregiver with an approved application.
 * Success 200: bookings assigned to request.user._id.
 * @param {import("express").Request} request - Caregiver list request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>} Resolves after returning the list.
 * @sideEffects Reads caller-owned Booking records.
 */
export async function listCaregiverBookings(request, response) {
  const ownershipFilter = {
    caregiverId: request.user._id,
  };
  const bookingQuery = Booking.find(ownershipFilter).sort({
    createdAt: -1,
  });
  const bookings = await populateBooking(bookingQuery);
  const formattedBookings = [];

  for (const booking of bookings) {
    formattedBookings.push(formatBooking(booking));
  }

  response.json({
    success: true,
    data: {
      count: formattedBookings.length,
      bookings: formattedBookings,
    },
  });
}

/**
 * PATCH /api/caregiver/bookings/:bookingId/status
 * Auth: authenticated caregiver with an approved application.
 * Body: accepted, declined, or completed status and optional reason.
 * Failure 404 conceals missing and other-caregiver bookings. Failure 409
 * protects stale transitions and early completion when the demo override is
 * disabled. Failure 422 covers invalid input.
 * Transaction: booking status, reservations, assignment, and family
 * notification are changed together.
 * @param {import("express").Request} request - Caregiver status request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>} Resolves after returning the booking.
 * @sideEffects Updates booking records and creates a family notification.
 */
export async function updateCaregiverBookingStatus(request, response) {
  const bookingId = request.params.bookingId;

  if (!mongoose.isValidObjectId(bookingId)) {
    throw new ApiError(404, "Booking not found.");
  }

  const status = String(request.body?.status || "");
  const reason = String(request.body?.reason || "")
    .trim()
    .slice(0, 500);
  const allowedStatuses = ["accepted", "declined", "completed"];

  // includes clearly checks membership in this small allowed set.
  if (!allowedStatuses.includes(status)) {
    throw new ApiError(
      422,
      "Choose accepted, declined, or completed.",
    );
  }

  if (status === "declined" && !reason) {
    throw new ApiError(
      422,
      "Give the family a reason for declining.",
    );
  }

  const ownershipFilter = {
    _id: bookingId,
    caregiverId: request.user._id,
  };
  const existingBooking = await Booking.findOne(ownershipFilter);

  if (!existingBooking) {
    // Missing and another caregiver's booking intentionally share this 404.
    throw new ApiError(404, "Booking not found.");
  }

  let allowedPreviousStatuses = ["pending"];

  if (status === "completed") {
    allowedPreviousStatuses = ["accepted", "confirmed"];
  }

  if (!allowedPreviousStatuses.includes(existingBooking.status)) {
    throw new ApiError(
      409,
      "A "
        + existingBooking.status
        + " booking cannot be marked "
        + status
        + ".",
    );
  }

  if (status === "completed" && !env.allowEarlyBookingCompletion) {
    // at(-1) reads the final item without calculating its index.
    const finalOccurrence = existingBooking.occurrences?.at(-1);

    if (!finalOccurrence) {
      throw new ApiError(
        409,
        "This legacy booking must be migrated before completion.",
      );
    }

    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const localToday = year + "-" + month + "-" + day;
    const finalVisitDate = dateKey(finalOccurrence.date);
    const endMinutes = parseTimeSlot(finalOccurrence.timeSlot).end;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const finalVisitIsInFuture = finalVisitDate > localToday;
    const finalVisitIsToday = finalVisitDate === localToday;
    const finalVisitHasNotEnded =
      finalVisitIsToday && currentMinutes < endMinutes;

    if (finalVisitIsInFuture || finalVisitHasNotEnded) {
      throw new ApiError(
        409,
        "A booking can be completed only after its final visit ends.",
      );
    }
  }

  const session = await mongoose.startSession();
  let booking;

  try {
    await session.withTransaction(async () => {
      const statusUpdate = {
        status,
        statusReason: reason,
        reviewedAt: new Date(),
      };

      if (status === "completed") {
        statusUpdate.reviewedAt = existingBooking.reviewedAt;
        statusUpdate.completedAt = new Date();
      }

      const currentStateFilter = {
        _id: existingBooking._id,
        caregiverId: request.user._id,
        status: {
          $in: allowedPreviousStatuses,
        },
      };
      const bookingUpdate = {
        $set: statusUpdate,
      };

      // Rechecking the state atomically prevents conflicting transitions.
      booking = await Booking.findOneAndUpdate(
        currentStateFilter,
        bookingUpdate,
        {
          new: true,
          session,
        },
      );

      if (!booking) {
        return;
      }

      const releasesReservations =
        status === "declined" || status === "completed";

      if (releasesReservations) {
        await BookingReservation.deleteMany({
          bookingId: booking._id,
        }).session(session);
        await FamilyBookingReservation.deleteMany({
          bookingId: booking._id,
        }).session(session);
      }

      await synchronizeBookingAssignment(booking, session);

      let notificationTitle = "Booking accepted";
      let notificationMessage =
        "A caregiver accepted your booking request.";
      let notificationType = "booking-accepted";

      if (status === "declined") {
        notificationTitle = "Booking declined";
        notificationMessage =
          "A caregiver declined your booking request.";
        notificationType = "booking-declined";
      }

      if (status === "completed") {
        notificationTitle = "Care visit completed";
        notificationMessage =
          "A caregiver marked your booking as completed.";
        notificationType = "booking-completed";
      }

      let actionPath = "/bookings";

      if (status === "completed") {
        actionPath = "/bookings?review=" + booking._id;
      }

      await createBookingNotification({
        booking,
        recipientUserId: booking.familyMemberId,
        actorUserId: booking.caregiverId,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        actionPath,
        session,
      });
    });
  } finally {
    await session.endSession();
  }

  if (!booking) {
    throw new ApiError(
      409,
      "The booking status changed while it was being reviewed.",
    );
  }

  response.json({
    success: true,
    data: {
      message: "Booking " + status + ".",
      booking: formatBooking(booking),
    },
  });
}
