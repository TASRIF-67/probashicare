import { Booking, BOOKING_STATUSES } from "../models/Booking.js";
import { ApiError } from "../utils/ApiError.js";

const DEFAULT_PAGE_SIZE = 3;
const MAXIMUM_PAGE_SIZE = 20;

/**
 * Converts a query value into a safe positive integer.
 * @param {unknown} value - Query value supplied by the client.
 * @param {number} fallback - Value used when parsing fails.
 * @returns {number} Positive whole number.
 * @sideEffects None.
 */
function parsePositiveInteger(value, fallback) {
  const parsedValue = Number.parseInt(String(value || ""), 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return parsedValue;
}

/**
 * Converts a populated Booking document into an admin-safe audit record.
 * Private family and caregiver email addresses are intentionally omitted.
 * @param {import("mongoose").Document} booking - Populated booking document.
 * @returns {{id: string, family: object|null, caregiver: object|null, elderlyProfile: object|null, bookingType: string, serviceType: string, startDate: Date, endDate: Date, occurrences: object[], status: string, statusReason: string, createdAt: Date, updatedAt: Date}} Admin booking record.
 * @sideEffects None.
 */
function formatAdminBooking(booking) {
  const family = booking.familyMemberId?._id
    ? booking.familyMemberId
    : null;
  const caregiver = booking.caregiverId?._id
    ? booking.caregiverId
    : null;
  const elderlyProfile = booking.elderlyProfileId?.personalInformation
    ? booking.elderlyProfileId
    : null;
  let elderlyName = "Legacy care recipient";

  if (elderlyProfile) {
    elderlyName = elderlyProfile.personalInformation.preferredName
      || elderlyProfile.personalInformation.fullName;
  }

  return {
    id: booking._id.toString(),
    family: family
      ? {
          id: family._id.toString(),
          name: family.name,
        }
      : null,
    caregiver: caregiver
      ? {
          id: caregiver._id.toString(),
          name: caregiver.name,
        }
      : null,
    elderlyProfile: elderlyProfile
      ? {
          id: elderlyProfile._id.toString(),
          name: elderlyName,
        }
      : null,
    bookingType: booking.bookingType,
    serviceType: booking.serviceType,
    startDate: booking.startDate,
    endDate: booking.endDate,
    occurrences: booking.occurrences || [],
    status: booking.status,
    statusReason: booking.statusReason || "",
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}

/**
 * GET /api/admin/bookings?status=all&page=1&limit=3
 * Query: optional exact booking `status`, positive `page`, and `limit` up to 20.
 * Success 200: `{ success: true, data: { bookings, summary, pagination } }`.
 * Failure 422: unsupported status filter. Authentication failures use the standard shape.
 * Auth: authenticated `admin` only through the shared admin route guard.
 * @param {import("express").Request} request - Admin request with audit filters.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads booking counts and a populated booking page from MongoDB.
 */
export async function listAdminBookings(request, response) {
  const status = String(request.query.status || "all").trim().toLowerCase();
  const page = parsePositiveInteger(request.query.page, 1);
  const requestedLimit = parsePositiveInteger(
    request.query.limit,
    DEFAULT_PAGE_SIZE,
  );
  const limit = Math.min(requestedLimit, MAXIMUM_PAGE_SIZE);

  if (status !== "all" && !BOOKING_STATUSES.includes(status)) {
    throw new ApiError(422, "Choose a valid booking status or all.");
  }

  const bookingFilter = {};

  if (status !== "all") {
    bookingFilter.status = status;
  }

  const skip = (page - 1) * limit;
  const [bookings, filteredTotal, statusCounts] = await Promise.all([
    Booking.find(bookingFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("familyMemberId", "name role")
      .populate("caregiverId", "name role")
      .populate(
        "elderlyProfileId",
        "personalInformation.fullName personalInformation.preferredName",
      ),
    Booking.countDocuments(bookingFilter),
    Booking.aggregate([
      {
        $group: {
          _id: "$status",
          count: {
            $sum: 1,
          },
        },
      },
    ]),
  ]);

  const summary = {
    all: 0,
    pending: 0,
    accepted: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
    declined: 0,
  };

  for (const statusCount of statusCounts) {
    if (summary[statusCount._id] !== undefined) {
      summary[statusCount._id] = statusCount.count;
      summary.all += statusCount.count;
    }
  }

  response.json({
    success: true,
    data: {
      bookings: bookings.map(formatAdminBooking),
      summary,
      pagination: {
        page,
        limit,
        total: filteredTotal,
        pages: Math.ceil(filteredTotal / limit),
      },
    },
  });
}
