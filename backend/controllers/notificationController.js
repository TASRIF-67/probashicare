import { Notification } from "../models/Notification.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * GET /api/notifications
 * Auth: any authenticated user; recipient always comes from request.user.
 * Query: optional page, limit, and unread=true.
 * Success 200: caller-owned notifications and unread count.
 * Failure: shared authentication/database response.
 * @param {import("express").Request} request - Authenticated list request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads caller-owned notifications.
 */
export async function listNotifications(request, response) {
  const page = Math.max(1, Number.parseInt(request.query.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(request.query.limit, 10) || 20),
  );
  const filter = { recipient: request.user._id };

  if (request.query.unread === "true") {
    filter.isRead = false;
  }

  const results = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Notification.countDocuments({ recipient: request.user._id, isRead: false }),
    Notification.countDocuments(filter),
  ]);
  response.json({
    success: true,
    data: {
      notifications: results[0],
      unreadCount: results[1],
      pagination: {
        page,
        limit,
        total: results[2],
        pages: Math.ceil(results[2] / limit),
      },
    },
  });
}

/**
 * PATCH /api/notifications/:notificationId/read
 * Auth: authenticated notification owner.
 * Params: notificationId; body/query unused.
 * Success 200: caller-owned notification marked read.
 * Failure 404: malformed, missing, or other-user notification.
 * @param {import("express").Request} request - Notification owner request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Updates read status and timestamp.
 */
export async function markNotificationRead(request, response) {
  const notification = await Notification.findOneAndUpdate(
    { _id: request.params.notificationId, recipient: request.user._id },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true },
  );

  if (!notification) {
    throw new ApiError(404, "Notification not found.");
  }

  response.json({ success: true, data: { notification } });
}

/**
 * PATCH /api/notifications/read-all
 * Auth: any authenticated user; recipient comes from request.user.
 * Body/query/params: unused.
 * Success 200: number of caller-owned unread notifications changed to read.
 * @param {import("express").Request} request - Authenticated notification owner.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Updates all unread notifications owned by the caller.
 */
export async function markAllNotificationsRead(
  request,
  response,
) {
  const readAt = new Date();
  const result = await Notification.updateMany(
    {
      recipient: request.user._id,
      isRead: false,
    },
    {
      $set: {
        isRead: true,
        readAt,
      },
    },
  );

  response.json({
    success: true,
    data: {
      modifiedCount: result.modifiedCount,
      unreadCount: 0,
      readAt,
    },
  });
}

/**
 * PATCH /api/notifications/:notificationId/dismiss
 * Auth: authenticated notification owner.
 * Params: notificationId; body: validated dismissal hours.
 * Success 200: reminder dismissal persisted.
 * Failure 404: malformed, missing, or other-user notification.
 * @param {import("express").Request} request - Reminder dismissal request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Updates dismissedUntil on one caller-owned notification.
 */
export async function dismissNotification(request, response) {
  const dismissedUntil = new Date(
    Date.now() + request.reminderDismissalHours * 60 * 60 * 1000,
  );
  const notification = await Notification.findOneAndUpdate(
    { _id: request.params.notificationId, recipient: request.user._id },
    { $set: { dismissedUntil } },
    { new: true },
  );

  if (!notification) {
    throw new ApiError(404, "Notification not found.");
  }

  response.json({ success: true, data: { notification } });
}
