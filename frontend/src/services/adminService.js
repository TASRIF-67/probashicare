import { api } from "./api.js";

/**
 * Retrieves live metrics and recent registrations for the admin overview.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<{metrics: object, attention: object, recentRegistrations: object[]}>} Overview data.
 * @sideEffects Calls GET `/admin/overview`.
 */
async function getOverview() {
  const response = await api.get("/admin/overview");
  return response.data.data;
}

/**
 * Lists family accounts visible to an authenticated administrator.
 * @param {string} [search=""] - Optional name/email search text.
 * @returns {Promise<{users: object[], count: number}>} Family account collection.
 * @sideEffects Calls GET `/admin/users`.
 */
async function listFamilyUsers(search = "") {
  const response = await api.get("/admin/users", { params: { role: "family", search } });
  return response.data.data;
}

/**
 * Permanently deletes an unlinked family account.
 * @param {string} userId - Family User identifier.
 * @returns {Promise<{message: string, deletedUserId: string}>} Deletion confirmation.
 * @sideEffects Calls DELETE `/admin/users/:userId` and removes database records.
 */
async function deleteFamilyUser(userId) {
  const response = await api.delete(`/admin/users/${userId}`);
  return response.data.data;
}

/**
 * Lists caregiver applications for an admin-selected status.
 * @param {string} [status="submitted"] - Application status filter.
 * @returns {Promise<{applications: object[], count: number}>} Matching applications.
 * @sideEffects Calls GET `/admin/caregiver-applications`.
 */
async function listCaregiverApplications(status = "submitted") {
  const response = await api.get("/admin/caregiver-applications", { params: { status } });
  return response.data.data;
}

/**
 * Retrieves one caregiver application for admin review.
 * @param {string} profileId - CaregiverProfile identifier.
 * @returns {Promise<{application: object}>} Detailed application with signed document link.
 * @sideEffects Calls GET `/admin/caregiver-applications/:profileId`.
 */
async function getCaregiverApplication(profileId) {
  const response = await api.get(`/admin/caregiver-applications/${profileId}`);
  return response.data.data;
}

/**
 * Approves a submitted caregiver application.
 * @param {string} profileId - CaregiverProfile identifier.
 * @returns {Promise<{application: object, message: string}>} Approved application and confirmation.
 * @sideEffects Calls PATCH and writes review state in MongoDB.
 */
async function approveCaregiverApplication(profileId) {
  const response = await api.patch(`/admin/caregiver-applications/${profileId}/approve`);
  return response.data.data;
}

/**
 * Rejects a submitted caregiver application with a required reason.
 * @param {string} profileId - CaregiverProfile identifier.
 * @param {string} reason - Actionable feedback for the caregiver.
 * @returns {Promise<{application: object, message: string}>} Rejected application and confirmation.
 * @sideEffects Calls PATCH and writes rejection review state in MongoDB.
 */
async function rejectCaregiverApplication(profileId, reason) {
  const response = await api.patch(`/admin/caregiver-applications/${profileId}/reject`, { reason });
  return response.data.data;
}

/**
 * Retrieves subscription revenue and access analytics for the Admin dashboard.
 * @returns {Promise<object>} Simulated payment totals and subscription metrics.
 * @sideEffects Calls GET `/admin/subscriptions/analytics`.
 */
async function getSubscriptionAnalytics() {
  const response = await api.get("/admin/subscriptions/analytics");
  return response.data.data;
}

/**
 * Lists simulated subscription transactions for administrators.
 * @param {{status?: string, search?: string, page?: number, limit?: number}} [filters] - Transaction filters.
 * @returns {Promise<{payments: object[], pagination: object, simulated: boolean}>} Transaction page.
 * @sideEffects Calls GET `/admin/subscriptions/payments`.
 */
async function listSubscriptionPayments(filters = {}) {
  const response = await api.get("/admin/subscriptions/payments", {
    params: filters,
  });
  return response.data.data;
}

/**
 * Lists read-only family-to-caregiver booking records for administrators.
 * @param {{status?: string, page?: number, limit?: number}} [filters] - Booking audit filters.
 * @returns {Promise<{bookings: object[], summary: object, pagination: object}>} Booking audit page.
 * @sideEffects Calls GET `/admin/bookings`.
 */
async function listBookings(filters = {}) {
  const response = await api.get("/admin/bookings", {
    params: filters,
  });
  return response.data.data;
}
export const adminService = {
  listBookings,
  getSubscriptionAnalytics,
  listSubscriptionPayments,
  getOverview,
  listFamilyUsers,
  deleteFamilyUser,
  listCaregiverApplications,
  getCaregiverApplication,
  approveCaregiverApplication,
  rejectCaregiverApplication,
};
