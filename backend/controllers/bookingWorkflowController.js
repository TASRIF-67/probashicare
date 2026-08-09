import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { BookingReservation } from "../models/BookingReservation.js";
import { syncCareAssignmentFromBooking } from "../services/careAssignmentService.js";
import { createNotification } from "../services/notificationService.js";
import { ApiError } from "../utils/ApiError.js";
import { buildReservationDocuments, dateKey, parseTimeSlot } from "../utils/bookingSchedule.js";

function formatBooking(booking) {
  const caregiver = booking.caregiverId?._id ? booking.caregiverId : null;
  const family = booking.familyMemberId?._id ? booking.familyMemberId : null;
  const elderly = booking.elderlyProfileId?.personalInformation ? booking.elderlyProfileId : null;
  return { _id: booking._id, caregiverId: caregiver?._id?.toString() || booking.caregiverId?.toString(), elderlyProfileId: elderly?._id?.toString() || booking.elderlyProfileId?.toString(), caregiver: caregiver ? { id: caregiver._id.toString(), name: caregiver.name } : null, familyMember: family ? { id: family._id.toString(), name: family.name } : null, elderlyProfile: elderly ? { id: elderly._id.toString(), name: elderly.personalInformation.preferredName || elderly.personalInformation.fullName } : null, bookingType: booking.bookingType, serviceType: booking.serviceType, startDate: booking.startDate, endDate: booking.endDate, slots: booking.slots || [], occurrences: booking.occurrences || [], status: booking.status, statusReason: booking.statusReason || "", migrationStatus: booking.migrationStatus || "requires-review", createdAt: booking.createdAt, updatedAt: booking.updatedAt };
}

const populateBooking = (query) => query.populate("caregiverId", "name role").populate("familyMemberId", "name role").populate("elderlyProfileId", "personalInformation.fullName personalInformation.preferredName");

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
 * @param {{booking: import("../models/Booking.js").Booking, recipientUserId: string|import("mongoose").Types.ObjectId, actorUserId: string|import("mongoose").Types.ObjectId, type: string, title: string, message: string, actionPath: string, session: import("mongoose").ClientSession}} input - Booking event notification details.
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

export async function createBooking(request, response) {
  const input = request.bookingInput;
  const session = await mongoose.startSession();
  let bookingId;
  try {
    await session.withTransaction(async () => {
      const [booking] = await Booking.create([{ familyMemberId: request.user._id, caregiverId: input.caregiverId, elderlyProfileId: input.elderlyProfileId, bookingType: input.bookingType, serviceType: input.serviceType, startDate: input.startDate, endDate: input.endDate, timeSlot: input.occurrences[0].timeSlot, slots: input.slots, occurrences: input.occurrences, status: "pending", schemaVersion: 2, migrationStatus: "current" }], { session });
      bookingId = booking._id;
      const reservations = buildReservationDocuments({ bookingId, caregiverId: input.caregiverId, occurrences: input.occurrences });
      await BookingReservation.insertMany(reservations, { ordered: true, session });
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
    if (error?.code === 11000 || error?.writeErrors?.some((entry) => entry.code === 11000)) throw new ApiError(409, "One or more selected slots were just booked. Choose another schedule.");
    throw error;
  } finally {
    await session.endSession();
  }
  const populated = await populateBooking(Booking.findById(bookingId));
  response.status(201).json({ success: true, data: { message: "Booking request created successfully.", booking: formatBooking(populated) } });
}

export async function listMyBookings(request, response) {
  const bookings = await populateBooking(Booking.find({ familyMemberId: request.user._id }).sort({ createdAt: -1 }));
  response.json({ success: true, data: { count: bookings.length, bookings: bookings.map(formatBooking) } });
}

export async function cancelMyBooking(request, response) {
  if (!mongoose.isValidObjectId(request.params.bookingId)) throw new ApiError(404, "Booking not found.");
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const session = await mongoose.startSession();
  let booking;
  await session.withTransaction(async () => {
    booking = await Booking.findOneAndUpdate({ _id: request.params.bookingId, familyMemberId: request.user._id, status: { $in: ["pending", "accepted", "confirmed"] }, occurrences: { $elemMatch: { date: { $gte: today } } } }, { $set: { status: "cancelled", statusReason: String(request.body?.reason || "Cancelled by family").slice(0, 500), cancelledAt: now } }, { new: true, session });
    if (booking) {
      await BookingReservation.deleteMany({ bookingId: booking._id }).session(session);
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
    }
  }).finally(() => session.endSession());
  if (!booking) throw new ApiError(409, "This booking cannot be cancelled.");
  response.json({ success: true, data: { message: "Booking cancelled.", booking: formatBooking(booking) } });
}

export async function listCaregiverBookings(request, response) {
  const bookings = await populateBooking(Booking.find({ caregiverId: request.user._id }).sort({ createdAt: -1 }));
  response.json({ success: true, data: { count: bookings.length, bookings: bookings.map(formatBooking) } });
}

export async function updateCaregiverBookingStatus(request, response) {
  if (!mongoose.isValidObjectId(request.params.bookingId)) throw new ApiError(404, "Booking not found.");
  const status = String(request.body?.status || "");
  const reason = String(request.body?.reason || "").trim().slice(0, 500);
  if (!["accepted", "declined", "completed"].includes(status)) throw new ApiError(422, "Choose accepted, declined, or completed.");
  if (status === "declined" && !reason) throw new ApiError(422, "Give the family a reason for declining.");
  const existing = await Booking.findOne({ _id: request.params.bookingId, caregiverId: request.user._id });
  if (!existing) throw new ApiError(404, "Booking not found.");
  const allowedFrom = status === "completed" ? ["accepted", "confirmed"] : ["pending"];
  if (!allowedFrom.includes(existing.status)) throw new ApiError(409, `A ${existing.status} booking cannot be marked ${status}.`);
  if (status === "completed") {
    const finalOccurrence = existing.occurrences?.at(-1);
    if (!finalOccurrence) throw new ApiError(409, "This legacy booking must be migrated before completion.");
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const endMinutes = parseTimeSlot(finalOccurrence.timeSlot).end;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    if (dateKey(finalOccurrence.date) > localToday || (dateKey(finalOccurrence.date) === localToday && currentMinutes < endMinutes)) throw new ApiError(409, "A booking can be completed only after its final visit ends.");
  }
  const session = await mongoose.startSession();
  let booking;
  await session.withTransaction(async () => {
    booking = await Booking.findOneAndUpdate({ _id: existing._id, caregiverId: request.user._id, status: { $in: allowedFrom } }, { $set: { status, statusReason: reason, reviewedAt: status === "completed" ? existing.reviewedAt : new Date(), ...(status === "completed" ? { completedAt: new Date() } : {}) } }, { new: true, session });
    if (booking) {
      if (["declined", "completed"].includes(status)) {
        await BookingReservation.deleteMany({ bookingId: booking._id }).session(session);
      }

      await synchronizeBookingAssignment(booking, session);

      let notificationTitle = "Booking accepted";
      let notificationMessage = "A caregiver accepted your booking request.";
      let notificationType = "booking-accepted";

      if (status === "declined") {
        notificationTitle = "Booking declined";
        notificationMessage = "A caregiver declined your booking request.";
        notificationType = "booking-declined";
      }

      if (status === "completed") {
        notificationTitle = "Care visit completed";
        notificationMessage = "A caregiver marked your booking as completed.";
        notificationType = "booking-completed";
      }

      await createBookingNotification({
        booking,
        recipientUserId: booking.familyMemberId,
        actorUserId: booking.caregiverId,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        actionPath: "/bookings",
        session,
      });
    }
  }).finally(() => session.endSession());
  if (!booking) throw new ApiError(409, "The booking status changed while it was being reviewed.");
  response.json({ success: true, data: { message: `Booking ${status}.`, booking: formatBooking(booking) } });
}
