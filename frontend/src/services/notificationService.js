import { api } from "./api.js";

/**
 * Loads caller-owned notifications.
 * @param {object} [params] - Pagination and unread filter query.
 * @returns {Promise<object>} Notifications, unread count, and pagination.
 * @sideEffects Sends an authenticated GET request.
 */
async function list(params = {}) {
  const response = await api.get("/notifications", { params });
  return response.data.data;
}

/**
 * Alias used by NotificationContext for loading notification data.
 * @param {object} [params] - Pagination and unread filter query.
 * @returns {Promise<object>} Notifications, unread count, and pagination.
 * @sideEffects Sends an authenticated GET request.
 */
async function listNotifications(params = {}) {
  return list(params);
}

/**
 * Loads only the caller's unread-count summary.
 * @returns {Promise<{unreadCount: number}>} Current unread count.
 * @sideEffects Sends an authenticated GET request.
 */
async function getUnreadCount() {
  const data = await list({
    page: 1,
    limit: 1,
    unread: true,
  });

  return {
    unreadCount: data.unreadCount,
  };
}

/**
 * Marks one caller-owned notification read.
 * @param {string} id - Notification identifier.
 * @returns {Promise<object>} Updated notification.
 * @sideEffects Sends an authenticated PATCH request.
 */
async function markRead(id) {
  const response = await api.patch(`/notifications/${id}/read`);
  return response.data.data.notification;
}

/**
 * Context-compatible wrapper for marking one notification read.
 * @param {string} id - Notification identifier.
 * @returns {Promise<{notification: object}>} Updated notification wrapper.
 * @sideEffects Sends an authenticated PATCH request.
 */
async function markAsRead(id) {
  const notification = await markRead(id);

  return {
    notification,
  };
}

/**
 * Marks every unread notification owned by the caller read.
 * @returns {Promise<{modifiedCount: number, unreadCount: number, readAt: string}>} Bulk update summary.
 * @sideEffects Sends an authenticated PATCH request.
 */
async function markAllAsRead() {
  const response = await api.patch("/notifications/read-all");
  return response.data.data;
}

/**
 * Dismisses one caller-owned reminder.
 * @param {string} id - Notification identifier.
 * @param {number} [hours=24] - Dismissal duration.
 * @returns {Promise<object>} Updated notification.
 * @sideEffects Sends an authenticated PATCH request.
 */
async function dismiss(id, hours = 24) {
  const response = await api.patch(`/notifications/${id}/dismiss`, {
    hours,
  });
  return response.data.data.notification;
}

export const notificationService = {
  list,
  listNotifications,
  getUnreadCount,
  markRead,
  markAsRead,
  markAllAsRead,
  dismiss,
};
