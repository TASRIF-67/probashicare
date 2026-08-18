import mongoose from "mongoose";
import { Notification } from "../models/Notification.js";
import { ApiError } from "../utils/ApiError.js";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

/**
 * Parses bounded notification pagination values.
 * @param {Record<string, unknown>} query - Express query parameters.
 * @returns {{page: number, limit: number, skip: number}} Safe pagination values.
 * @sideEffects Throws a 422 ApiError for invalid values.
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
    throw new ApiError(422, "Limit must be between 1 and 50.");
  }

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

/**
 * GET /api/notifications?page=1&limit=20&status=all|unread
 * Success 200: notification page, unread count, and pagination metadata.
 * Auth: any authenticated user; only the caller's notifications are returned.
 * @param {import("express").Request} request - Authenticated list request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads and counts Notification documents.
 */
export async function listNotifications(request, response) {
  const pagination = parsePagination(request.query);
  const status = request.query.status || "all";

  if (!["all", "unread"].includes(status)) {
    throw new ApiError(422, "Status must be all or unread.");
  }

  const filter = {
    recipientUserId: request.user._id,
  };

  if (status === "unread") {
    filter.readAt = null;
  }
  // run three independent database operations at the same time
  const results = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(), //returns pure JS notation
    Notification.countDocuments(filter),
    Notification.countDocuments({
      recipientUserId: request.user._id,
      readAt: null,
    }),
  ]);

  const notifications = results[0];
  const total = results[1];
  const unreadCount = results[2];

  response.json({
    success: true,
    data: {
      notifications,
      unreadCount,
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
 * GET /api/notifications/unread-count
 * Success 200: unread notification count.
 * Auth: any authenticated user.
 * @param {import("express").Request} request - Authenticated count request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Counts the caller's unread Notification documents.
 */
export async function getUnreadNotificationCount(request, response) {
  const unreadCount = await Notification.countDocuments({
    recipientUserId: request.user._id,
    readAt: null,
  });

  response.json({
    success: true,
    data: {
      unreadCount,
    },
  });
}

/**
 * PATCH /api/notifications/:notificationId/read
 * Success 200: caller-owned notification with its read time set.
 * Auth: any authenticated user; inaccessible IDs return a concealed 404.
 * @param {import("express").Request} request - Authenticated update request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Marks one caller-owned Notification as read.
 */
export async function markNotificationAsRead(request, response) {
  const notificationId = request.params.notificationId;

  if (!mongoose.isValidObjectId(notificationId)) {
    throw new ApiError(404, "Notification not found.");
  }

  const notification = await Notification.findOneAndUpdate(
    {
      _id: notificationId,
      recipientUserId: request.user._id,
    },
    {
      $set: {
        readAt: new Date(),
      },
    },
    {
      new: true,
    },
  );

  if (!notification) {
    throw new ApiError(404, "Notification not found.");
  }

  response.json({
    success: true,
    data: {
      notification,
    },
  });
}

/**
 * PATCH /api/notifications/read-all
 * Success 200: number of notifications changed.
 * Auth: any authenticated user; only the caller's records are updated.
 * @param {import("express").Request} request - Authenticated bulk update request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Marks all caller-owned unread Notifications as read.
 */
export async function markAllNotificationsAsRead(request, response) {
  const result = await Notification.updateMany(
    {
      recipientUserId: request.user._id,
      readAt: null,
    },
    {
      $set: {
        readAt: new Date(),
      },
    },
  );

  response.json({
    success: true,
    data: {
      modifiedCount: result.modifiedCount,
    },
  });
}
