import { ApiError } from "../utils/ApiError.js";
import { Booking, BOOKING_TYPES } from "../models/Booking.js";
import { CaregiverProfile } from "../models/CaregiverProfile.js";
import { User } from "../models/User.js";

const TIME_SLOT_PATTERN = /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/;

function parseTime(value) {
  const [hours, minutes] = String(value).split(":").map(Number);
  return hours * 60 + minutes;
}

function dayNameFor(date) {
  return new Date(date).toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
}

function timeRangeOverlaps(firstStart, firstEnd, secondStart, secondEnd) {
  return firstStart < secondEnd && secondStart < firstEnd;
}

function isDateObjectValid(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function toLocalDate(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

export async function validateBookingRequest(request, _response, next) {
  const body = request.body ?? {};
  const bookingType = String(body.bookingType ?? "").trim().toLowerCase();
  const serviceType = String(body.serviceType ?? "").trim();
  const timeSlot = String(body.timeSlot ?? "").trim();
  const selectedDay = String(body.day ?? body.bookingDay ?? "").trim().toLowerCase();
  const startDateInput = body.startDate;
  const endDateInput = body.endDate ?? body.startDate;

  const errors = {};

  if (!BOOKING_TYPES.includes(bookingType)) {
    errors.bookingType = "Choose a valid booking type.";
  }
  if (!serviceType) {
    errors.serviceType = "Select the care service you need.";
  }
  if (!TIME_SLOT_PATTERN.test(timeSlot)) {
    errors.timeSlot = "Use a time slot in the format HH:MM-HH:MM.";
  }

  const startDate = startDateInput ? toLocalDate(startDateInput) : null;
  const endDate = endDateInput ? toLocalDate(endDateInput) : null;

  if (!startDateInput || !isDateObjectValid(startDate)) {
    errors.startDate = "Choose a valid start date.";
  }
  if (bookingType !== "one-time" && (!endDateInput || !isDateObjectValid(endDate))) {
    errors.endDate = "Choose a valid end date for this booking.";
  }
  if (bookingType === "one-time" && endDateInput && isDateObjectValid(toLocalDate(endDateInput)) && toLocalDate(endDateInput) < startDate) {
    errors.endDate = "End date cannot be before the selected start date.";
  }
  if (startDate && endDate && endDate < startDate) {
    errors.endDate = "End date cannot be before the start date.";
  }

  const caregiverId = body.caregiverId;
  if (!caregiverId) {
    errors.caregiverId = "Choose a caregiver before submitting the booking.";
  }

  if (Object.keys(errors).length) {
    next(new ApiError(422, "Please correct the booking information.", errors));
    return;
  }

  const caregiverUser = await User.findById(caregiverId);
  if (!caregiverUser || caregiverUser.role !== "caregiver") {
    next(new ApiError(422, "Please select a verified caregiver.", { caregiverId: "Choose a valid caregiver." }));
    return;
  }

  const caregiverProfile = await CaregiverProfile.findOne({ userId: caregiverUser._id });
  if (!caregiverProfile || caregiverProfile.applicationStatus !== "approved") {
    next(new ApiError(422, "This caregiver is not currently accepting bookings.", { caregiverId: "Caregiver unavailable." }));
    return;
  }

  if (!caregiverProfile.supportedServiceTypes.includes(serviceType)) {
    next(new ApiError(422, "This caregiver does not provide the selected service type.", { serviceType: "Select one of the caregiver service types." }));
    return;
  }

  const [requestedStartText, requestedEndText] = timeSlot.split("-");
  const requestedStartTime = parseTime(requestedStartText);
  const requestedEndTime = parseTime(requestedEndText);

  const bookingRangeStart = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const bookingRangeEnd = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const normalizedRange = [];

  for (let cursor = new Date(bookingRangeStart); cursor <= bookingRangeEnd; cursor.setDate(cursor.getDate() + 1)) {
    normalizedRange.push(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()));
  }

  const relevantRange = selectedDay
    ? normalizedRange.filter((entry) => dayNameFor(entry) === selectedDay)
    : normalizedRange;

  const hasDailyAvailability = relevantRange.every((entry) => {
    const dayName = dayNameFor(entry);
    return caregiverProfile.availability.some((slot) => {
      if (slot.day !== dayName) return false;
      const slotStart = parseTime(slot.startTime);
      const slotEnd = parseTime(slot.endTime);
      return requestedStartTime >= slotStart && requestedEndTime <= slotEnd;
    });
  });

  if (!hasDailyAvailability || !relevantRange.length) {
    next(new ApiError(422, "This caregiver is unavailable during the requested time slot.", { timeSlot: "Choose a different date or time." }));
    return;
  }

  const overlappingBookings = await Booking.find({
    caregiverId: caregiverUser._id,
    status: { $nin: ["cancelled", "completed"] },
    startDate: { $lte: bookingRangeEnd },
    endDate: { $gte: bookingRangeStart },
  });

  const hasTimeConflict = overlappingBookings.some((existingBooking) => {
    const existingTimes = existingBooking.timeSlot.split("-");
    const existingStart = parseTime(existingTimes[0]);
    const existingEnd = parseTime(existingTimes[1]);
    return timeRangeOverlaps(requestedStartTime, requestedEndTime, existingStart, existingEnd);
  });

  if (hasTimeConflict) {
    next(new ApiError(409, "The requested time overlaps with an existing booking.", { timeSlot: "Choose another time slot." }));
    return;
  }

  request.body = {
    caregiverId: caregiverUser._id,
    bookingType,
    serviceType,
    startDate: new Date(startDate),
    endDate: new Date(endDate ?? startDate),
    timeSlot,
    day: selectedDay || undefined,
  };

  next();
}
