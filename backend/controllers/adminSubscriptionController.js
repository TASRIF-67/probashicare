import { FamilySubscription } from "../models/FamilySubscription.js";
import { SubscriptionPayment } from "../models/SubscriptionPayment.js";
import { ApiError } from "../utils/ApiError.js";
import { expireStalePrototypePayments } from "../services/prototypePaymentService.js";

const PAYMENT_STATUS_FILTERS = [
  "all",
  "pending",
  "completed",
  "failed",
  "cancelled",
  "refunded",
];

/**
 * Escapes characters that have special meaning in a MongoDB regular expression.
 * @param {string} value - User-entered literal search text.
 * @returns {string} Text safe to use as a literal case-insensitive regex.
 * @sideEffects None.
 */
export function escapeRegularExpression(value) {
  const specialCharacters = "\\^$.*+?()[]{}|";
  let escapedValue = "";

  for (const character of value) {
    // `includes` checks whether this one character is a regex operator.
    if (specialCharacters.includes(character)) {
      escapedValue += "\\";
    }

    escapedValue += character;
  }

  return escapedValue;
}

/**
 * GET /api/admin/subscriptions/analytics
 * Auth: administrator through the shared admin route gate.
 * Success 200: payment totals/revenue, access counts, plan distribution, and
 * five recent transactions.
 * @param {import("express").Request} _request - Authenticated admin request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>} Resolves after analytics are sent.
 * @sideEffects Expires stale prototypes and reads MongoDB aggregates.
 */
export async function getSubscriptionAnalytics(_request, response) {
  await expireStalePrototypePayments();

  const now = new Date();

  const paymentStatusTotalsPromise = SubscriptionPayment.aggregate([
    {
      $group: {
        // `_id` is the group key: one result row per payment status.
        _id: "$status",
        count: {
          $sum: 1,
        },
        amount: {
          $sum: "$amount",
        },
      },
    },
  ]);

  const activePremiumFamiliesPromise = FamilySubscription.countDocuments({
    status: "active",
    accessLevel: "premium",
    currentPeriodEndsAt: {
      $gt: now,
    },
  });

  const activeTrialsPromise = FamilySubscription.countDocuments({
    status: "trialing",
    currentPeriodEndsAt: {
      $gt: now,
    },
  });

  const planDistributionPromise = SubscriptionPayment.aggregate([
    {
      // Only successful payments contribute to plan revenue.
      $match: {
        status: "completed",
      },
    },
    {
      $group: {
        _id: "$planSnapshot.code",
        name: {
          $first: "$planSnapshot.name",
        },
        transactions: {
          $sum: 1,
        },
        revenue: {
          $sum: "$amount",
        },
      },
    },
    {
      $sort: {
        revenue: -1,
      },
    },
  ]);

  const recentPaymentsPromise = SubscriptionPayment.find()
    // Admin reporting is authorized to view family name/email.
    .populate("family", "name email")
    .sort({
      createdAt: -1,
    })
    .limit(5)
    .lean();

  // These five reads are independent, so Promise.all reduces total waiting
  // time. Destructuring gives each returned array value a clear name.
  const [
    paymentStatusRows,
    activePremiumFamilies,
    activeTrials,
    planDistribution,
    recentPayments,
  ] = await Promise.all([
    paymentStatusTotalsPromise,
    activePremiumFamiliesPromise,
    activeTrialsPromise,
    planDistributionPromise,
    recentPaymentsPromise,
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

  for (const row of paymentStatusRows) {
    totals.all += row.count;

    // Bracket notation uses the status value as the property name.
    totals[row._id] = row.count;

    if (row._id === "completed") {
      totals.completedRevenue = row.amount;
    }
  }

  response.json({
    success: true,
    data: {
      totals,
      activePremiumFamilies,
      activeTrials,
      planDistribution,
      recentPayments,
      currency: "BDT",
      // Prototype and Stripe are sandbox/test financial records.
      simulated: true,
    },
  });
}

/**
 * GET /api/admin/subscriptions/payments?status=all&page=1&limit=20&search=...
 * Auth: administrator through the shared admin route gate.
 * Success 200: filtered transaction page and pagination.
 * @param {import("express").Request} request - Admin filters and pagination.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>} Resolves after the page is sent.
 * @sideEffects Expires stale prototypes and reads payments/family identities.
 */
export async function listSubscriptionPayments(request, response) {
  await expireStalePrototypePayments();

  const status = request.query.status || "all";
  // `Number` converts complete query text. Decimals remain decimals and are
  // rejected by Number.isInteger below.
  const page = Number(request.query.page || 1);
  const limit = Number(request.query.limit || 20);
  const search = String(request.query.search || "").trim();

  if (!PAYMENT_STATUS_FILTERS.includes(status)) {
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
    const safeSearch = escapeRegularExpression(search);

    filter.transactionReference = {
      $regex: safeSearch,
      $options: "i",
    };
  }

  const paymentsPromise = SubscriptionPayment.find(filter)
    .populate("family", "name email")
    .sort({
      createdAt: -1,
    })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const totalPromise = SubscriptionPayment.countDocuments(filter);

  const [payments, total] = await Promise.all([paymentsPromise, totalPromise]);

  response.json({
    success: true,
    data: {
      payments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      simulated: true,
    },
  });
}
