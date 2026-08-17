import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import {
  CaregiverComplaint,
  COMPLAINT_CATEGORIES,
  COMPLAINT_STATUSES,
} from "../models/CaregiverComplaint.js";
import {
  CaregiverReview,
  REVIEW_MODERATION_STATUSES,
} from "../models/CaregiverReview.js";
import { User } from "../models/User.js";
import {
  createNotification,
  createNotificationsForUsers,
} from "../services/notificationService.js";
import { ApiError } from "../utils/ApiError.js";

const DEFAULT_PAGE_SIZE = 3;
const MAXIMUM_PAGE_SIZE = 20;

/**
 * Converts an optional query value into a safe positive integer.
 * @param {unknown} value - Query value received from Express.
 * @param {number} fallback - Value used when the query is missing or invalid.
 * @returns {number} A positive whole number.
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
 * Builds pagination values shared by feedback list endpoints.
 * @param {import("express").Request} request - Request containing page and limit query values.
 * @returns {{page: number, limit: number, skip: number}} Safe pagination values.
 * @sideEffects None.
 */
function getPagination(request) {
  const page = parsePositiveInteger(request.query.page, 1);
  const requestedLimit = parsePositiveInteger(
    request.query.limit,
    DEFAULT_PAGE_SIZE,
  );
  const limit = Math.min(requestedLimit, MAXIMUM_PAGE_SIZE);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

/**
 * Returns a review shape that never identifies the family or elderly person.
 * @param {import("mongoose").Document} review - Stored caregiver review.
 * @returns {{id: string, rating: number, feedback: string, reviewerLabel: string, createdAt: Date}} Anonymous verified review.
 * @sideEffects None.
 */
function formatAnonymousReview(review) {
  return {
    id: review._id.toString(),
    rating: review.rating,
    feedback: review.feedback || "",
    reviewerLabel: "Verified family booking",
    createdAt: review.createdAt,
  };
}

/**
 * Returns the family-visible details for its own submitted review.
 * @param {import("mongoose").Document} review - Stored caregiver review.
 * @returns {{id: string, bookingId: string, caregiverId: string, rating: number, feedback: string, moderationStatus: string, createdAt: Date}} Family review record.
 * @sideEffects None.
 */
function formatFamilyReview(review) {
  return {
    id: review._id.toString(),
    bookingId: review.bookingId.toString(),
    caregiverId: review.caregiverId.toString(),
    rating: review.rating,
    feedback: review.feedback || "",
    moderationStatus: review.moderationStatus,
    createdAt: review.createdAt,
  };
}

/**
 * Returns one family-visible complaint without exposing administrator identity.
 * @param {import("mongoose").Document} complaint - Stored complaint document.
 * @returns {{id: string, bookingId: string, caregiverId: string, category: string, description: string, status: string, adminResponse: string, createdAt: Date, resolvedAt: Date|null}} Family complaint record.
 * @sideEffects None.
 */
function formatFamilyComplaint(complaint) {
  return {
    id: complaint._id.toString(),
    bookingId: complaint.bookingId.toString(),
    caregiverId: complaint.caregiverId.toString(),
    category: complaint.category,
    description: complaint.description,
    status: complaint.status,
    adminResponse: complaint.adminResponse || "",
    createdAt: complaint.createdAt,
    resolvedAt: complaint.resolvedAt || null,
  };
}

/**
 * Converts a populated review into an administrator audit record.
 * @param {import("mongoose").Document} review - Populated caregiver review.
 * @returns {object} Review with family, caregiver, elderly, and booking context.
 * @sideEffects None.
 */
function formatAdminReview(review) {
  return {
    id: review._id.toString(),
    bookingId: review.bookingId?._id?.toString()
      || review.bookingId?.toString(),
    bookingService: review.bookingId?.serviceType || "",
    family: review.familyMemberId?._id
      ? {
          id: review.familyMemberId._id.toString(),
          name: review.familyMemberId.name,
          email: review.familyMemberId.email,
        }
      : null,
    caregiver: review.caregiverId?._id
      ? {
          id: review.caregiverId._id.toString(),
          name: review.caregiverId.name,
        }
      : null,
    elderlyProfile: review.elderlyProfileId?._id
      ? {
          id: review.elderlyProfileId._id.toString(),
          name: review.elderlyProfileId.personalInformation?.preferredName
            || review.elderlyProfileId.personalInformation?.fullName
            || "Care recipient",
        }
      : null,
    rating: review.rating,
    feedback: review.feedback || "",
    moderationStatus: review.moderationStatus,
    createdAt: review.createdAt,
  };
}

/**
 * Converts a populated complaint into an administrator investigation record.
 * @param {import("mongoose").Document} complaint - Populated complaint document.
 * @returns {object} Complaint with participant, booking, and resolution context.
 * @sideEffects None.
 */
function formatAdminComplaint(complaint) {
  return {
    id: complaint._id.toString(),
    bookingId: complaint.bookingId?._id?.toString()
      || complaint.bookingId?.toString(),
    bookingService: complaint.bookingId?.serviceType || "",
    family: complaint.familyMemberId?._id
      ? {
          id: complaint.familyMemberId._id.toString(),
          name: complaint.familyMemberId.name,
          email: complaint.familyMemberId.email,
        }
      : null,
    caregiver: complaint.caregiverId?._id
      ? {
          id: complaint.caregiverId._id.toString(),
          name: complaint.caregiverId.name,
        }
      : null,
    elderlyProfile: complaint.elderlyProfileId?._id
      ? {
          id: complaint.elderlyProfileId._id.toString(),
          name: complaint.elderlyProfileId.personalInformation?.preferredName
            || complaint.elderlyProfileId.personalInformation?.fullName
            || "Care recipient",
        }
      : null,
    category: complaint.category,
    description: complaint.description,
    status: complaint.status,
    adminResponse: complaint.adminResponse || "",
    createdAt: complaint.createdAt,
    resolvedAt: complaint.resolvedAt || null,
  };
}

/**
 * POST /api/bookings/:bookingId/review
 * Body: `{ rating: integer 1..5, feedback?: string up to 1500 characters }`.
 * Success 201: `{ success: true, data: { message, review } }`.
 * Failure 404: booking is invalid or not owned by this family. Failure 409:
 * booking is unfinished or already reviewed. Failure 422: invalid input.
 * Auth: verified Family account through the booking route guard.
 * @param {import("express").Request} request - Family request and review input.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Creates one verified review and caregiver notification transactionally.
 */
export async function submitCaregiverReview(request, response) {
  if (!mongoose.isValidObjectId(request.params.bookingId)) {
    throw new ApiError(404, "Completed booking not found.");
  }

  const rating = Number(request.body?.rating);
  const feedback = String(request.body?.feedback || "").trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ApiError(422, "Choose a rating from 1 to 5 stars.");
  }

  if (feedback.length > 1500) {
    throw new ApiError(422, "Feedback cannot exceed 1500 characters.");
  }

  const session = await mongoose.startSession();
  let createdReview;

  try {
    await session.withTransaction(async () => {
      // Including the family ID in this query conceals other families' bookings.
      const booking = await Booking.findOne({
        _id: request.params.bookingId,
        familyMemberId: request.user._id,
      }).session(session);

      if (!booking) {
        throw new ApiError(404, "Completed booking not found.");
      }

      if (booking.status !== "completed") {
        throw new ApiError(
          409,
          "Feedback can be submitted only after the care booking is completed.",
        );
      }

      const reviews = await CaregiverReview.create(
        [
          {
            bookingId: booking._id,
            caregiverId: booking.caregiverId,
            familyMemberId: booking.familyMemberId,
            elderlyProfileId: booking.elderlyProfileId || null,
            rating,
            feedback,
          },
        ],
        {
          session,
        },
      );
      createdReview = reviews[0];

      await createNotification({
        recipientUserId: booking.caregiverId,
        actorUserId: booking.familyMemberId,
        type: "caregiver-review-received",
        priority: "normal",
        title: "New verified feedback",
        message: "A family submitted anonymous feedback for completed care.",
        actionPath: "/caregiver/reviews",
        relatedEntityType: "caregiver-review",
        relatedEntityId: createdReview._id,
        eventKey: "caregiver-review:" + createdReview._id,
        session,
      });
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, "Feedback has already been submitted for this booking.");
    }

    throw error;
  } finally {
    await session.endSession();
  }

  response.status(201).json({
    success: true,
    data: {
      message: "Thank you. Your verified feedback was submitted anonymously.",
      review: formatFamilyReview(createdReview),
    },
  });
}

/**
 * POST /api/bookings/:bookingId/complaint
 * Body: `{ category: string, description: string }`.
 * Success 201: family-visible complaint record. Failure 404 conceals bookings
 * owned by another family. Failure 409 rejects unfinished or duplicate reports.
 * Auth: verified Family account through the booking route guard.
 * @param {import("express").Request} request - Family complaint request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Creates a private complaint and notifies every administrator.
 */
export async function submitCaregiverComplaint(request, response) {
  if (!mongoose.isValidObjectId(request.params.bookingId)) {
    throw new ApiError(404, "Completed booking not found.");
  }

  const category = String(request.body?.category || "").trim();
  const description = String(request.body?.description || "").trim();

  if (!COMPLAINT_CATEGORIES.includes(category)) {
    throw new ApiError(422, "Choose a valid complaint category.");
  }

  if (description.length < 20 || description.length > 2000) {
    throw new ApiError(
      422,
      "Complaint details must contain between 20 and 2000 characters.",
    );
  }

  const session = await mongoose.startSession();
  let createdComplaint;

  try {
    await session.withTransaction(async () => {
      const booking = await Booking.findOne({
        _id: request.params.bookingId,
        familyMemberId: request.user._id,
      }).session(session);

      if (!booking) {
        throw new ApiError(404, "Completed booking not found.");
      }

      if (booking.status !== "completed") {
        throw new ApiError(
          409,
          "A complaint can be submitted only after the care booking is completed.",
        );
      }

      const complaints = await CaregiverComplaint.create(
        [
          {
            bookingId: booking._id,
            caregiverId: booking.caregiverId,
            familyMemberId: booking.familyMemberId,
            elderlyProfileId: booking.elderlyProfileId || null,
            category,
            description,
          },
        ],
        {
          session,
        },
      );
      createdComplaint = complaints[0];

      const administrators = await User.find({ role: "admin" })
        .select("_id")
        .session(session);
      const administratorIds = [];

      for (const administrator of administrators) {
        administratorIds.push(administrator._id);
      }

      await createNotificationsForUsers({
        recipientUserIds: administratorIds,
        actorUserId: booking.familyMemberId,
        type: "caregiver-complaint-submitted",
        priority: "important",
        title: "New caregiver complaint",
        message: "A family submitted a complaint about completed care.",
        actionPath: "/admin/feedback",
        relatedEntityType: "caregiver-complaint",
        relatedEntityId: createdComplaint._id,
        eventKey: "caregiver-complaint:" + createdComplaint._id,
        session,
      });
    });
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, "A complaint already exists for this booking.");
    }

    throw error;
  } finally {
    await session.endSession();
  }

  response.status(201).json({
    success: true,
    data: {
      message: "Your complaint was sent privately to the administrator.",
      complaint: formatFamilyComplaint(createdComplaint),
    },
  });
}

/**
 * GET /api/bookings/complaints/mine
 * Query: optional positive page and limit. Body and params are unused.
 * Success 200: family complaint page and pagination information.
 * Auth: verified Family account.
 * @param {import("express").Request} request - Family request and pagination query.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads only the authenticated family's complaints.
 */
export async function listMyComplaints(request, response) {
  const pagination = getPagination(request);
  const filter = {
    familyMemberId: request.user._id,
  };
  const [complaints, total] = await Promise.all([
    CaregiverComplaint.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    CaregiverComplaint.countDocuments(filter),
  ]);
  const formattedComplaints = [];

  for (const complaint of complaints) {
    formattedComplaints.push(formatFamilyComplaint(complaint));
  }

  response.json({
    success: true,
    data: {
      complaints: formattedComplaints,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        pages: Math.ceil(total / pagination.limit),
      },
    },
  });
}

/**
 * GET /api/caregivers/reviews/mine
 * Query: optional page and limit. Success exposes anonymous verified reviews
 * and rating totals without any family, elderly, or booking identifiers.
 * Auth: approved Caregiver account through the caregiver route guard.
 * @param {import("express").Request} request - Caregiver request and pagination query.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads published reviews and a rating aggregate from MongoDB.
 */
export async function listMyCaregiverReviews(request, response) {
  const pagination = getPagination(request);
  const filter = {
    caregiverId: request.user._id,
    moderationStatus: "published",
  };
  const [reviews, total, ratingSummary] = await Promise.all([
    CaregiverReview.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    CaregiverReview.countDocuments(filter),
    CaregiverReview.aggregate([
      {
        $match: filter,
      },
      {
        $group: {
          _id: null,
          averageRating: {
            $avg: "$rating",
          },
          reviewCount: {
            $sum: 1,
          },
        },
      },
    ]),
  ]);
  const formattedReviews = [];

  for (const review of reviews) {
    formattedReviews.push(formatAnonymousReview(review));
  }

  response.json({
    success: true,
    data: {
      reviews: formattedReviews,
      summary: {
        averageRating: ratingSummary[0]?.averageRating || 0,
        reviewCount: ratingSummary[0]?.reviewCount || 0,
      },
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        pages: Math.ceil(total / pagination.limit),
      },
    },
  });
}

/**
 * GET /api/caregivers/:id/reviews
 * Query: optional page and limit. Success exposes only published anonymous
 * reviews for a verified caregiver. Authentication is Family or Admin.
 * @param {import("express").Request} request - Marketplace review request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads caregiver identity and published reviews.
 */
export async function listCaregiverPublicReviews(request, response) {
  if (!mongoose.isValidObjectId(request.params.id)) {
    throw new ApiError(404, "Caregiver not found.");
  }

  const caregiver = await User.findOne({
    _id: request.params.id,
    role: "caregiver",
    isVerified: true,
  });

  if (!caregiver) {
    throw new ApiError(404, "Caregiver not found.");
  }

  const pagination = getPagination(request);
  const filter = {
    caregiverId: caregiver._id,
    moderationStatus: "published",
  };
  const [reviews, total] = await Promise.all([
    CaregiverReview.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit),
    CaregiverReview.countDocuments(filter),
  ]);
  const formattedReviews = [];

  for (const review of reviews) {
    formattedReviews.push(formatAnonymousReview(review));
  }

  response.json({
    success: true,
    data: {
      caregiver: {
        id: caregiver._id.toString(),
        name: caregiver.name,
      },
      reviews: formattedReviews,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        pages: Math.ceil(total / pagination.limit),
      },
    },
  });
}

/**
 * GET /api/admin/caregiver-reviews
 * Query: optional moderation status, page, and limit. Success returns attributed
 * review audit records. Auth: Admin only through the shared admin route guard.
 * @param {import("express").Request} request - Admin review filters.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads populated review records and moderation counts.
 */
export async function listAdminCaregiverReviews(request, response) {
  const status = String(request.query.status || "all").trim();

  if (status !== "all" && !REVIEW_MODERATION_STATUSES.includes(status)) {
    throw new ApiError(422, "Choose published, hidden, or all reviews.");
  }

  const pagination = getPagination(request);
  const filter = {};

  if (status !== "all") {
    filter.moderationStatus = status;
  }

  const [reviews, total, published, hidden] = await Promise.all([
    CaregiverReview.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate("bookingId", "serviceType completedAt")
      .populate("familyMemberId", "name email")
      .populate("caregiverId", "name")
      .populate(
        "elderlyProfileId",
        "personalInformation.fullName personalInformation.preferredName",
      ),
    CaregiverReview.countDocuments(filter),
    CaregiverReview.countDocuments({ moderationStatus: "published" }),
    CaregiverReview.countDocuments({ moderationStatus: "hidden" }),
  ]);
  const formattedReviews = [];

  for (const review of reviews) {
    formattedReviews.push(formatAdminReview(review));
  }

  response.json({
    success: true,
    data: {
      reviews: formattedReviews,
      summary: {
        all: published + hidden,
        published,
        hidden,
      },
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        pages: Math.ceil(total / pagination.limit),
      },
    },
  });
}

/**
 * PATCH /api/admin/caregiver-reviews/:reviewId/moderation
 * Body: `{ status: "published"|"hidden" }`. Success returns the updated audit
 * review. Failure 404 conceals invalid identifiers. Auth: Admin only.
 * @param {import("express").Request} request - Admin moderation request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Updates review marketplace visibility.
 */
export async function moderateCaregiverReview(request, response) {
  if (!mongoose.isValidObjectId(request.params.reviewId)) {
    throw new ApiError(404, "Caregiver review not found.");
  }

  const status = String(request.body?.status || "").trim();

  if (!REVIEW_MODERATION_STATUSES.includes(status)) {
    throw new ApiError(422, "Choose published or hidden.");
  }

  const review = await CaregiverReview.findByIdAndUpdate(
    request.params.reviewId,
    {
      $set: {
        moderationStatus: status,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  )
    .populate("bookingId", "serviceType completedAt")
    .populate("familyMemberId", "name email")
    .populate("caregiverId", "name")
    .populate(
      "elderlyProfileId",
      "personalInformation.fullName personalInformation.preferredName",
    );

  if (!review) {
    throw new ApiError(404, "Caregiver review not found.");
  }

  response.json({
    success: true,
    data: {
      message: "Review visibility updated.",
      review: formatAdminReview(review),
    },
  });
}

/**
 * GET /api/admin/caregiver-complaints
 * Query: optional complaint status, page, and limit. Success returns attributed
 * investigation records and status totals. Auth: Admin only.
 * @param {import("express").Request} request - Admin complaint filters.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads populated complaint records and status counts.
 */
export async function listAdminCaregiverComplaints(request, response) {
  const status = String(request.query.status || "all").trim();

  if (status !== "all" && !COMPLAINT_STATUSES.includes(status)) {
    throw new ApiError(422, "Choose open, under-review, resolved, or all complaints.");
  }

  const pagination = getPagination(request);
  const filter = {};

  if (status !== "all") {
    filter.status = status;
  }

  const [complaints, total, open, underReview, resolved] = await Promise.all([
    CaregiverComplaint.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .populate("bookingId", "serviceType completedAt")
      .populate("familyMemberId", "name email")
      .populate("caregiverId", "name")
      .populate(
        "elderlyProfileId",
        "personalInformation.fullName personalInformation.preferredName",
      ),
    CaregiverComplaint.countDocuments(filter),
    CaregiverComplaint.countDocuments({ status: "open" }),
    CaregiverComplaint.countDocuments({ status: "under-review" }),
    CaregiverComplaint.countDocuments({ status: "resolved" }),
  ]);
  const formattedComplaints = [];

  for (const complaint of complaints) {
    formattedComplaints.push(formatAdminComplaint(complaint));
  }

  response.json({
    success: true,
    data: {
      complaints: formattedComplaints,
      summary: {
        all: open + underReview + resolved,
        open,
        underReview,
        resolved,
      },
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        pages: Math.ceil(total / pagination.limit),
      },
    },
  });
}

/**
 * PATCH /api/admin/caregiver-complaints/:complaintId
 * Body: `{ status, adminResponse? }`. A resolution requires a meaningful admin
 * response. Success returns the updated investigation record. Auth: Admin only.
 * @param {import("express").Request} request - Admin complaint resolution request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Updates the complaint and notifies the reporting family.
 */
export async function updateCaregiverComplaint(request, response) {
  if (!mongoose.isValidObjectId(request.params.complaintId)) {
    throw new ApiError(404, "Caregiver complaint not found.");
  }

  const status = String(request.body?.status || "").trim();
  const adminResponse = String(request.body?.adminResponse || "").trim();

  if (!COMPLAINT_STATUSES.includes(status)) {
    throw new ApiError(422, "Choose open, under-review, or resolved.");
  }

  if (adminResponse.length > 2000) {
    throw new ApiError(422, "Administrator response cannot exceed 2000 characters.");
  }

  if (status === "resolved" && adminResponse.length < 10) {
    throw new ApiError(
      422,
      "Add a clear resolution of at least 10 characters before resolving.",
    );
  }

  const session = await mongoose.startSession();
  let complaint;

  try {
    await session.withTransaction(async () => {
      const updates = {
        status,
        adminResponse,
        reviewedBy: request.user._id,
        resolvedAt: null,
      };

      if (status === "resolved") {
        updates.resolvedAt = new Date();
      }

      complaint = await CaregiverComplaint.findByIdAndUpdate(
        request.params.complaintId,
        {
          $set: updates,
        },
        {
          new: true,
          runValidators: true,
          session,
        },
      );

      if (!complaint) {
        throw new ApiError(404, "Caregiver complaint not found.");
      }

      await createNotification({
        recipientUserId: complaint.familyMemberId,
        actorUserId: request.user._id,
        type: "caregiver-complaint-updated",
        priority: "important",
        title: "Complaint status updated",
        message: "Your caregiver complaint is now " + status.replace("-", " ") + ".",
        actionPath: "/bookings",
        relatedEntityType: "caregiver-complaint",
        relatedEntityId: complaint._id,
        eventKey: "caregiver-complaint:" + complaint._id + ":" + status,
        session,
      });
    });
  } finally {
    await session.endSession();
  }

  await complaint.populate("bookingId", "serviceType completedAt");
  await complaint.populate("familyMemberId", "name email");
  await complaint.populate("caregiverId", "name");
  await complaint.populate(
    "elderlyProfileId",
    "personalInformation.fullName personalInformation.preferredName",
  );

  response.json({
    success: true,
    data: {
      message: "Complaint status updated.",
      complaint: formatAdminComplaint(complaint),
    },
  });
}
