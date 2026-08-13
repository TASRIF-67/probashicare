import { api } from "./api.js";

/** Loads caller-owned notifications. @param {object} [params] - Pagination/filter query. @returns {Promise<object>} Notifications and unread count. @sideEffects Calls the API. */
async function list(params = {}) {
  const response = await api.get("/notifications", { params });
  return response.data.data;
}

/** Marks one owned notification read. @param {string} id - Notification ID. @returns {Promise<object>} Updated notification. @sideEffects Calls the API. */
async function markRead(id) {
  const response = await api.patch(`/notifications/${id}/read`);
  return response.data.data.notification;
}

/** Dismisses one owned reminder. @param {string} id - Notification ID. @param {number} hours - Duration. @returns {Promise<object>} Updated notification. @sideEffects Calls the API. */
async function dismiss(id, hours = 24) {
  const response = await api.patch(`/notifications/${id}/dismiss`, {
    hours,
  });
  return response.data.data.notification;
}

export const notificationService = { list, markRead, dismiss };
