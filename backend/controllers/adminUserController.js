import mongoose from "mongoose";
import { ElderlyFamilyLink } from "../models/ElderlyFamilyLink.js";
import { ElderlyProfile } from "../models/ElderlyProfile.js";
import { EmailVerificationToken } from "../models/EmailVerificationToken.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { toPublicUser } from "../utils/userResponse.js";
import { CaregiverProfile } from "../models/CaregiverProfile.js";

/**
 * GET /api/admin/overview
 * Body/params/query: none.
 * Success 200: `{ success: true, data: { metrics, attention, recentRegistrations } }`.
 * Failure: standard authentication or server error shape.
 * Auth: authenticated `admin` only.
 * @param {import("express").Request} _request - Authenticated admin request, otherwise unused.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads family, elderly-profile, and caregiver-application aggregates from MongoDB.
 */
export async function getAdminOverview(_request, response) {
  const [
    totalFamilies,
    verifiedFamilies,
    activeElderlyProfiles,
    archivedElderlyProfiles,
    submittedCaregiverApplications,
    approvedCaregivers,
    recentRegistrations,
  ] = await Promise.all([
    User.countDocuments({ role: "family" }),
    User.countDocuments({ role: "family", isVerified: true }),
    ElderlyProfile.countDocuments({ status: "active" }),
    ElderlyProfile.countDocuments({ status: "archived" }),
    CaregiverProfile.countDocuments({ applicationStatus: "submitted" }),
    CaregiverProfile.countDocuments({ applicationStatus: "approved" }),
    User.find({ role: "family" }).sort({ createdAt: -1 }).limit(5),
  ]);
  const unverifiedFamilies = totalFamilies - verifiedFamilies;

  response.json({
    success: true,
    data: {
      metrics: {
        totalFamilies,
        verifiedFamilies,
        unverifiedFamilies,
        activeElderlyProfiles,
        archivedElderlyProfiles,
        submittedCaregiverApplications,
        approvedCaregivers,
      },
      attention: {
        unverifiedFamilyAccounts: unverifiedFamilies,
        submittedCaregiverApplications,
      },
      recentRegistrations: recentRegistrations.map((user) => ({
        ...toPublicUser(user),
        createdAt: user.createdAt,
        authMethod: user.googleId ? "google" : "email",
      })),
    },
  });
}

/**
 * GET /api/admin/users?role=family&search=...
 * Query: optional `role` (currently family only) and `search`; body and params are unused.
 * Success 200: `{ success: true, data: { users: AdminUser[], count: number } }`.
 * Failure: standard validation or authentication error shape.
 * Auth: authenticated `admin` only.
 * @param {import("express").Request} request - Admin request with optional filters.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads users and elderly-family link counts from MongoDB.
 */
export async function listUsers(request, response) {
  const role = request.query.role || "family";
  const search = request.query.search?.trim() || "";
  if (role !== "family") {
    throw new ApiError(422, "Only family account management is available in this phase.");
  }

  const users = await User.find({
    role,
    ...(search
      ? {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
          ],
        }
      : {}),
  })
    .sort({ createdAt: -1 })
    .limit(200);

  const linkCounts = await ElderlyFamilyLink.aggregate([
    { $match: { familyUserId: { $in: users.map((user) => user._id) } } },
    { $group: { _id: "$familyUserId", count: { $sum: 1 } } },
  ]);
  const countsByUser = new Map(linkCounts.map((entry) => [entry._id.toString(), entry.count]));
  const result = users.map((user) => ({
    ...toPublicUser(user),
    linkedElderlyProfileCount: countsByUser.get(user._id.toString()) || 0,
    createdAt: user.createdAt,
    authMethod: user.googleId ? (user.password ? "email-and-google" : "google") : "email",
  }));

  response.json({ success: true, data: { users: result, count: result.length } });
}

/**
 * DELETE /api/admin/users/:userId
 * Params: `{ userId: string }`; body and query are unused.
 * Success 200: `{ success: true, data: { message: string, deletedUserId: string } }`.
 * Failure: concealed 404 for unknown/non-family IDs or 409 when elderly links exist.
 * Auth: authenticated `admin` only; admin accounts cannot be removed here.
 * @param {import("express").Request} request - Authenticated admin deletion request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Deletes an unlinked family User and their verification tokens in a transaction.
 */
export async function deleteFamilyUser(request, response) {
  if (!mongoose.isValidObjectId(request.params.userId)) {
    throw new ApiError(404, "Family account not found.");
  }

  const user = await User.findOne({ _id: request.params.userId, role: "family" });
  if (!user) throw new ApiError(404, "Family account not found.");

  const hasLinks = await ElderlyFamilyLink.exists({ familyUserId: user._id });
  if (hasLinks) {
    throw new ApiError(
      409,
      "This family account has linked elderly profiles and cannot be deleted. Archive or transfer those records first.",
    );
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await EmailVerificationToken.deleteMany({ userId: user._id }).session(session);
      await User.deleteOne({ _id: user._id }).session(session);
    });
  } finally {
    await session.endSession();
  }

  response.json({
    success: true,
    data: { message: "Family account deleted.", deletedUserId: user._id.toString() },
  });
}
