import { FamilySubscription } from "../models/FamilySubscription.js";
import { SubscriptionPayment } from "../models/SubscriptionPayment.js";
import { ApiError } from "../utils/ApiError.js";
import { expireStalePrototypePayments } from "../services/prototypePaymentService.js";

const PAYMENT_STATUSES = ["all", "pending", "completed", "failed", "cancelled", "refunded"];

/**
 * GET /api/admin/subscriptions/analytics
 * Success 200: payment totals, revenue, active access counts, plan distribution, and recent transactions.
 * Auth: administrator only through the shared admin route gate.
 * @param {import("express").Request} _request - Authenticated admin request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads subscription and payment aggregates from MongoDB.
 */
export async function getSubscriptionAnalytics(_request, response) {
  await expireStalePrototypePayments();
  const now = new Date();
  const results = await Promise.all([
    SubscriptionPayment.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          amount: { $sum: "$amount" },
        },
      },
    ]),
    FamilySubscription.countDocuments({
      status: "active",
      accessLevel: "premium",
      currentPeriodEndsAt: { $gt: now },
    }),
    FamilySubscription.countDocuments({
      status: "trialing",
      currentPeriodEndsAt: { $gt: now },
    }),
    SubscriptionPayment.aggregate([
      { $match: { status: "completed" } },
      {
        $group: {
          _id: "$planSnapshot.code",
          name: { $first: "$planSnapshot.name" },
          transactions: { $sum: 1 },
          revenue: { $sum: "$amount" },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    SubscriptionPayment.find()
      .populate("family", "name email")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const totals = {
    all: 0,
    pending: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    refunded: 0,
    completedRevenue: 0,
  };

  for (const row of results[0]) {
    totals.all += row.count;
    totals[row._id] = row.count;

    if (row._id === "completed") {
      totals.completedRevenue = row.amount;
    }
  }

  response.json({
    success: true,
    data: {
      totals,
      activePremiumFamilies: results[1],
      activeTrials: results[2],
      planDistribution: results[3],
      recentPayments: results[4],
      currency: "BDT",
      simulated: true,
    },
  });
}

/**
 * GET /api/admin/subscriptions/payments?status=all&page=1&limit=20&search=...
 * Success 200: filtered simulated transactions and pagination metadata.
 * Auth: administrator only; family payment ownership does not limit this business report.
 * @param {import("express").Request} request - Admin request with status, paging, and search filters.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads payment and family identity data from MongoDB.
 */
export async function listSubscriptionPayments(request, response) {
  await expireStalePrototypePayments();
  const status = request.query.status || "all";
  const page = Number(request.query.page || 1);
  const limit = Number(request.query.limit || 20);
  const search = String(request.query.search || "").trim();

  if (!PAYMENT_STATUSES.includes(status)) {
    throw new ApiError(422, "Payment status filter is invalid.");
  }

  if (!Number.isInteger(page) || page < 1) {
    throw new ApiError(422, "Page must be a positive integer.");
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ApiError(422, "Limit must be between 1 and 100.");
  }

  const filter = {};

  if (status !== "all") {
    filter.status = status;
  }

  if (search) {
    filter.transactionReference = {
      $regex: search,
      $options: "i",
    };
  }

  const results = await Promise.all([
    SubscriptionPayment.find(filter)
      .populate("family", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    SubscriptionPayment.countDocuments(filter),
  ]);

  response.json({
    success: true,
    data: {
      payments: results[0],
      pagination: {
        page,
        limit,
        total: results[1],
        pages: Math.ceil(results[1] / limit),
      },
      simulated: true,
    },
  });
}
