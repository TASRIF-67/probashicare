import { Notification } from "../models/Notification.js";
import { ApiError } from "../utils/ApiError.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAXIMUM_LIMIT = 100;
const HOURS_TO_MILLISECONDS = 60 * 60 * 1000;

/**
 * Converts a query-string value into a positive page or limit number.
 * @param {unknown} value - Value received from request.query.
 * @param {number} fallback - Number used when the input is absent or invalid.
 * @param {number|null} maximum - Optional upper limit.
 * @returns {number} A positive integer, optionally limited by maximum.
 * @sideEffects None.
 */
function readPositiveInteger(value, fallback, maximum = null) {
  // `Number.parseInt` reads an integer from a string using base 10.
  const parsedValue = Number.parseInt(value, 10);

  // The `||` fallback preserves the previous behavior for NaN and zero.
  const valueOrFallback = parsedValue || fallback;

  // `Math.max` prevents negative page and limit values.
  let safeValue = Math.max(1, valueOrFallback);

  if (maximum !== null) {
    // `Math.min` prevents clients from requesting excessively large pages.
    safeValue = Math.min(maximum, safeValue);
  }

  return safeValue;
}

/**
 * GET /api/notifications
 * Auth: any verified authenticated user.
 * Query: `page`, `limit`, and optional `unread=true`.
 * Success 200 shape:
 * `{ success, data: { notifications, unreadCount, pagination } }`.
 * Authorization: the recipient is always request.user._id. The client cannot
 * request another user's notifications.
 * @param {import("express").Request} request - Authenticated list request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>} Resolves after the response is sent.
 * @sideEffects Reads caller-owned Notification documents from MongoDB.
 */
export async function listNotifications(request, response) {
  const page = readPositiveInteger(request.query.page, DEFAULT_PAGE);
  const limit = readPositiveInteger(
    request.query.limit,
    DEFAULT_LIMIT,
    MAXIMUM_LIMIT,
  );

  const filter = {
    recipient: request.user._id,
  };

  if (request.query.unread === "true") {
    filter.isRead = false;
  }

  // A Mongoose query is awaitable. `lean()` returns plain objects because this
  // endpoint only reads data and does not need document methods such as save().
  const notificationsPromise = Notification.find(filter)
    .sort({
      createdAt: -1,
    })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const unreadCountPromise = Notification.countDocuments({
    recipient: request.user._id,
    isRead: false,
  });

  const filteredTotalPromise = Notification.countDocuments(filter);

  // `Promise.all` runs independent queries concurrently and preserves array
  // order. Destructuring gives each result a meaningful name.
  const [notifications, unreadCount, filteredTotal] = await Promise.all([
    notificationsPromise,
    unreadCountPromise,
    filteredTotalPromise,
  ]);

  // `Math.ceil` rounds a partial final page upward.
  const totalPages = Math.ceil(filteredTotal / limit);

  const responseBody = {
    success: true,
    data: {
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total: filteredTotal,
        pages: totalPages,
      },
    },
  };

  // `response.json` serializes the JavaScript object and ends the HTTP request.
  response.json(responseBody);
}

/**
 * PATCH /api/notifications/:notificationId/read
 * Auth: the signed-in user must own the notification.
 * Params: `notificationId` is validated as a MongoDB ObjectId by the route.
 * Success 200: `{ success, data: { notification } }`.
 * Failure 404: malformed IDs fail in middleware; missing and other-user records
 * both use the same concealed 404 response.
 * @param {import("express").Request} request - Notification owner request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>} Resolves after the response is sent.
 * @sideEffects Atomically updates one caller-owned Notification.
 */
export async function markNotificationRead(request, response) {
  const ownershipFilter = {
    _id: request.params.notificationId,
    recipient: request.user._id,
  };
  const update = {
    $set: {
      isRead: true,
      readAt: new Date(),
    },
  };
  const options = {
    // `new: true` returns the updated document.
    new: true,
  };

  // Ownership is part of the update query. This avoids loading a document and
  // then performing a separate permission check that could race with changes.
  const notification = await Notification.findOneAndUpdate(
    ownershipFilter,
    update,
    options,
  );

  if (!notification) {
    // The concealed 404 does not reveal whether another user owns this ID.
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
 * Auth: any verified authenticated user.
 * Body, params, and query: unused.
 * Success 200: modified count, zero unread count, and the shared read timestamp.
 * @param {import("express").Request} request - Authenticated owner request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>} Resolves after the response is sent.
 * @sideEffects Atomically updates every unread Notification owned by the caller.
 */
export async function markAllNotificationsRead(request, response) {
  // One Date object gives every notification changed by this operation exactly
  // the same read timestamp.
  const readAt = new Date();

  const ownershipFilter = {
    recipient: request.user._id,
    isRead: false,
  };
  const update = {
    $set: {
      isRead: true,
      readAt,
    },
  };

  // `updateMany` performs one database operation instead of one save per item.
  const result = await Notification.updateMany(ownershipFilter, update);

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
 * Auth: the signed-in user must own the notification.
 * Params: `notificationId`; body: validated `hours`.
 * Success 200: `{ success, data: { notification } }`.
 * Failure 404: missing and other-user records share a concealed response.
 * @param {import("express").Request} request - Reminder dismissal request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>} Resolves after the response is sent.
 * @sideEffects Updates dismissedUntil on one caller-owned Notification.
 */
export async function dismissNotification(request, response) {
  const dismissalDuration =
    request.reminderDismissalHours * HOURS_TO_MILLISECONDS;

  // `Date.now` returns the current Unix timestamp in milliseconds.
  const dismissedUntilTimestamp = Date.now() + dismissalDuration;
  const dismissedUntil = new Date(dismissedUntilTimestamp);

  const ownershipFilter = {
    _id: request.params.notificationId,
    recipient: request.user._id,
  };
  const update = {
    $set: {
      dismissedUntil,
    },
  };
  const options = {
    new: true,
  };

  const notification = await Notification.findOneAndUpdate(
    ownershipFilter,
    update,
    options,
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
