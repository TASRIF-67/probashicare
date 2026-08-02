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

export const adminService = { getOverview, listFamilyUsers, deleteFamilyUser };
