import { api } from "./api.js";

/**
 * Lists notifications belonging to the authenticated user.
 * @param {{page?: number, limit?: number, status?: "all"|"unread"}} [options] - Pagination and read-status filters.
 * @returns {Promise<{notifications: object[], unreadCount: number, pagination: object}>} Notification page.
 * @sideEffects Calls GET /notifications.
 */
async function listNotifications(options = {}) {
  const response = await api.get("/notifications", {
    params: options,
  });
  return response.data.data;
}

/**
 * Gets the authenticated user's unread notification count.
 * @returns {Promise<{unreadCount: number}>} Current unread count.
 * @sideEffects Calls GET /notifications/unread-count.
 */
async function getUnreadCount() {
  const response = await api.get("/notifications/unread-count");
  return response.data.data;
}

/**
 * Marks one authenticated-user notification as read.
 * @param {string} notificationId - Notification identifier.
 * @returns {Promise<{notification: object}>} Updated notification.
 * @sideEffects Calls PATCH /notifications/:notificationId/read.
 */
async function markAsRead(notificationId) {
  const response = await api.patch(
    "/notifications/" + notificationId + "/read",
  );
  return response.data.data;
}

/**
 * Marks every unread notification belonging to the current user as read.
 * @returns {Promise<{modifiedCount: number}>} Number of changed records.
 * @sideEffects Calls PATCH /notifications/read-all.
 */
async function markAllAsRead() {
  const response = await api.patch("/notifications/read-all");
  return response.data.data;
}

export const notificationService = {
  listNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
