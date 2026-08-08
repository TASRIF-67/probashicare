import { ApiError } from "../utils/ApiError.js";
import { BOOKING_TYPES } from "../models/Booking.js";
import { CaregiverProfile } from "../models/CaregiverProfile.js";
import { User } from "../models/User.js";
import { getAuthorizedElderlyProfile } from "../services/elderlyProfileAccessService.js";
import mongoose from "mongoose";
import { buildOccurrences, parseDateOnly, parseTimeSlot, weekday } from "../utils/bookingSchedule.js";

const DAY_NAMES = new Set(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
const MAX_OCCURRENCES = 366;

function validationError(errors) {
  return new ApiError(422, "Please correct the booking information.", errors);
}

export async function validateBookingRequest(request, _response, next) {
  const body = request.body || {};
  const bookingType = String(body.bookingType || "").trim().toLowerCase();
  const serviceType = String(body.serviceType || "").trim();
  const startDate = parseDateOnly(body.startDate);
  const endDate = parseDateOnly(bookingType === "one-time" ? body.startDate : body.endDate);
  const slots = Array.isArray(body.slots) ? body.slots.map((slot) => ({ weekday: String(slot?.weekday || "").trim().toLowerCase(), startTime: String(slot?.startTime || "").trim(), endTime: String(slot?.endTime || "").trim() })) : [];
  const errors = {};

  if (!BOOKING_TYPES.includes(bookingType)) errors.bookingType = "Choose a valid booking type.";
  if (!serviceType) errors.serviceType = "Select the care service you need.";
  if (!startDate) errors.startDate = "Choose a real date in YYYY-MM-DD format.";
  if (!endDate) errors.endDate = "Choose a real end date in YYYY-MM-DD format.";
  if (!mongoose.isValidObjectId(body.elderlyProfileId)) errors.elderlyProfileId = "Choose who will receive care.";
  if (!mongoose.isValidObjectId(body.caregiverId)) errors.caregiverId = "Choose a caregiver.";
  if (!slots.length) errors.slots = "Select at least one available slot.";
  if (slots.some((slot) => !DAY_NAMES.has(slot.weekday) || !parseTimeSlot(`${slot.startTime}-${slot.endTime}`))) errors.slots = "Choose valid daytime slots with an end after the start.";
  if (new Set(slots.map((slot) => slot.weekday)).size !== slots.length) errors.slots = "Choose only one slot per weekday.";

  if (startDate && endDate) {
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const spanDays = Math.floor((endDate - startDate) / 86400000) + 1;
    if (startDate < today) errors.startDate = "Bookings cannot start in the past.";
    if (endDate < startDate) errors.endDate = "End date cannot be before the start date.";
    if (bookingType === "one-time" && endDate.getTime() !== startDate.getTime()) errors.endDate = "One-time bookings use one date.";
    if (bookingType === "scheduled" && (spanDays < 2 || spanDays > 84)) errors.endDate = "Scheduled care must span 2 to 84 days.";
    if (bookingType === "long-term" && (spanDays < 28 || spanDays > 366)) errors.endDate = "Long-term care must span 28 days to one year.";
  }
  if (Object.keys(errors).length) return next(validationError(errors));

  let elderlyProfile;
  try {
    ({ profile: elderlyProfile } = await getAuthorizedElderlyProfile({ profileId: body.elderlyProfileId, familyUserId: request.user._id, permissions: ["owner", "editor"] }));
  } catch (_error) {
    return next(new ApiError(404, "The selected elderly profile is unavailable."));
  }

  const caregiverUser = await User.findOne({ _id: body.caregiverId, role: "caregiver", isVerified: true });
  if (!caregiverUser) return next(validationError({ caregiverId: "Choose a verified caregiver." }));
  const caregiverProfile = await CaregiverProfile.findOne({ userId: caregiverUser._id, applicationStatus: "approved" });
  if (!caregiverProfile) return next(validationError({ caregiverId: "This caregiver is unavailable." }));
  if (!caregiverProfile.supportedServiceTypes.includes(serviceType)) return next(validationError({ serviceType: "This caregiver does not offer that service." }));

  const availability = new Set((caregiverProfile.availability || []).map((slot) => `${slot.day}|${slot.startTime}|${slot.endTime}`));
  if (slots.some((slot) => !availability.has(`${slot.weekday}|${slot.startTime}|${slot.endTime}`))) return next(validationError({ slots: "Select slots from the caregiver's current availability." }));
  if (bookingType === "one-time" && (slots.length !== 1 || slots[0].weekday !== weekday(startDate))) return next(validationError({ slots: "The slot must match the selected date." }));

  const occurrences = buildOccurrences({ bookingType, startDate, endDate, slots });
  const occurringWeekdays = new Set(occurrences.map((occurrence) => weekday(occurrence.date)));
  if (!occurrences.length || occurrences.length > MAX_OCCURRENCES || slots.some((slot) => !occurringWeekdays.has(slot.weekday))) return next(validationError({ slots: "Every selected weekday must occur inside the date range." }));

  request.bookingInput = { caregiverId: caregiverUser._id, elderlyProfileId: elderlyProfile._id, bookingType, serviceType, startDate, endDate, slots, occurrences };
  next();
}
