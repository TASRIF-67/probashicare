import { api } from "./api.js";

/**
 * Loads caller-owned notifications.
 * @param {{page?: number, limit?: number, unread?: boolean}} [params] - Pagination and unread query values.
 * @returns {Promise<{
 *   notifications: object[],
 *   unreadCount: number,
 *   pagination: {page: number, limit: number, total: number, pages: number}
 * }>} Notification records and paging information.
 * @sideEffects Sends an authenticated GET request to the backend.
 */
async function list(params = {}) {
  // Axios converts `params` into a query string, for example:
  // `{ page: 2, unread: true }` becomes `?page=2&unread=true`.
  const requestOptions = {
    params,
  };
  const response = await api.get("/notifications", requestOptions);

  // Axios puts the backend JSON body in `response.data`. ProbashiCare wraps
  // successful payloads inside another `data` property.
  return response.data.data;
}

/**
 * Provides the method name used by NotificationContext.
 * @param {{page?: number, limit?: number, unread?: boolean}} [params] - Pagination and unread query values.
 * @returns {Promise<{
 *   notifications: object[],
 *   unreadCount: number,
 *   pagination: object
 * }>} Notification list response data.
 * @sideEffects Sends the same authenticated GET request as list.
 */
async function listNotifications(params = {}) {
  // Returning the Promise lets the caller decide where to await and catch it.
  return list(params);
}

/**
 * Loads a minimal page only to obtain the caller's unread count.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<{unreadCount: number}>} Current unread notification count.
 * @sideEffects Sends an authenticated GET request.
 */
async function getUnreadCount() {
  const query = {
    page: 1,
    limit: 1,
    unread: true,
  };
  const data = await list(query);

  return {
    unreadCount: data.unreadCount,
  };
}

/**
 * Marks one caller-owned notification as read.
 * @param {string} notificationId - MongoDB Notification identifier.
 * @returns {Promise<object>} Updated Notification record.
 * @sideEffects Sends an authenticated PATCH request.
 */
async function markRead(notificationId) {
  // String concatenation builds the URL without changing the identifier.
  const path = "/notifications/" + notificationId + "/read";
  const response = await api.patch(path);

  return response.data.data.notification;
}

/**
 * Wraps markRead in the shape used by NotificationContext.
 * @param {string} notificationId - MongoDB Notification identifier.
 * @returns {Promise<{notification: object}>} Updated record wrapper.
 * @sideEffects Sends an authenticated PATCH request.
 */
async function markAsRead(notificationId) {
  const notification = await markRead(notificationId);

  return {
    notification,
  };
}

/**
 * Marks every unread notification owned by the caller as read.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<{
 *   modifiedCount: number,
 *   unreadCount: number,
 *   readAt: string
 * }>} Bulk update summary.
 * @sideEffects Sends an authenticated PATCH request.
 */
async function markAllAsRead() {
  const response = await api.patch("/notifications/read-all");

  return response.data.data;
}

/**
 * Pauses one caller-owned reminder.
 * @param {string} notificationId - MongoDB Notification identifier.
 * @param {number} [hours=24] - Number of hours to pause the reminder.
 * @returns {Promise<object>} Updated Notification record.
 * @sideEffects Sends an authenticated PATCH request.
 */
async function dismiss(notificationId, hours = 24) {
  const path = "/notifications/" + notificationId + "/dismiss";
  const requestBody = {
    hours,
  };
  const response = await api.patch(path, requestBody);

  return response.data.data.notification;
}

// Exporting one service object gives components a single import while keeping
// each operation as a separately testable named function in this file.
export const notificationService = {
  list,
  listNotifications,
  getUnreadCount,
  markRead,
  markAsRead,
  markAllAsRead,
  dismiss,
};
