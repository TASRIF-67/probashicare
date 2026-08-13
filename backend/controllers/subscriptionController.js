import { FamilySubscription } from "../models/FamilySubscription.js";
import { SubscriptionPayment } from "../models/SubscriptionPayment.js";
import { SubscriptionPlan } from "../models/SubscriptionPlan.js";
import { ApiError } from "../utils/ApiError.js";
import {
  activateFamilyTrial,
  getFamilySubscriptionAccess,
} from "../services/subscriptionService.js";
import { synchronizeSubscriptionReminders } from "../services/subscriptionReminderService.js";
import {
  completePrototypePayment,
  createPrototypePayment,
  expireStalePrototypePayments,
  finishPrototypePayment,
} from "../services/prototypePaymentService.js";
import { synchronizeSubscriptionPlans } from "../services/subscriptionPlanService.js";

/**
 * GET /api/subscriptions/plans
 * Auth: any authenticated account; plans contain no family-private data.
 * Params/body: none; query unused.
 * Success 200: active backend-controlled plan list.
 * Failure: standard authentication/database error response.
 * @param {import("express").Request} _request - Authenticated request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads active SubscriptionPlan documents.
 */
export async function listSubscriptionPlans(_request, response) {
  let plans = await SubscriptionPlan.find({ isActive: true })
    .sort({ price: 1 })
    .lean();

  if (!plans.length) {
    await synchronizeSubscriptionPlans();
    plans = await SubscriptionPlan.find({ isActive: true })
      .sort({ price: 1 })
      .lean();
  }

  response.json({ success: true, data: { plans } });
}

/**
 * GET /api/subscriptions/me
 * Auth: authenticated Family account; ownership comes from request.user.
 * Params/body/query: none.
 * Success 200: subscription, effective access, and nearest reminder.
 * Failure: standard authentication/database error response.
 * @param {import("express").Request} request - Authenticated Family request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects May create a Core record, synchronize expiry, and upsert reminders.
 */
export async function getMySubscription(request, response) {
  const result = await getFamilySubscriptionAccess(request.user._id);
  const reminder = await synchronizeSubscriptionReminders(result.subscription);
  response.json({
    success: true,
    data: {
      subscription: result.subscription,
      access: result.access,
      reminder,
    },
  });
}

/**
 * POST /api/subscriptions/trial/activate
 * Auth: authenticated Family account.
 * Params/query/body: unused; trial dates are backend-controlled.
 * Success 201: activated one-time trial and effective Premium access.
 * Failure 409: trial already used; standard auth/database errors otherwise.
 * @param {import("express").Request} request - Authenticated Family request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Atomically activates the Family trial in MongoDB.
 */
export async function activateMyTrial(request, response) {
  const result = await activateFamilyTrial(request.user._id);
  response.status(201).json({ success: true, data: result });
}

/**
 * POST /api/subscriptions/purchase
 * Auth: authenticated Family account.
 * Body: validated planCode and prototype paymentMethod only.
 * Success 201: pending payment with authoritative plan snapshot and amount.
 * Failure 403/404/422: disabled simulation, missing plan, or invalid input.
 * @param {import("express").Request} request - Validated purchase request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Creates a pending SubscriptionPayment document.
 */
export async function purchaseSubscription(request, response) {
  const input = request.subscriptionPurchaseInput;
  const payment = await createPrototypePayment(
    request.user._id,
    input.planCode,
    input.paymentMethod,
  );
  response.status(201).json({ success: true, data: { payment } });
}

/**
 * GET /api/subscriptions/payments
 * Auth: authenticated Family account.
 * Query: page and limit are optional bounded positive integers.
 * Success 200: caller-owned immutable payment history and pagination.
 * Failure: standard authentication/database response.
 * @param {import("express").Request} request - Family payment-history request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads only caller-owned SubscriptionPayment documents.
 */
export async function listMySubscriptionPayments(request, response) {
  await expireStalePrototypePayments({ familyUserId: request.user._id });
  const page = Math.max(1, Number.parseInt(request.query.page, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(request.query.limit, 10) || 20),
  );
  const filter = { family: request.user._id };
  const results = await Promise.all([
    SubscriptionPayment.find(filter)
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
    },
  });
}

/**
 * POST /api/subscriptions/payments/:paymentId/simulate-success
 * Auth: authenticated Family owner.
 * Params: paymentId; body/query unused.
 * Success 200: completed payment, activated subscription, idempotency flag.
 * Failure 403/404/409: disabled simulation, wrong owner, or invalid state.
 * @param {import("express").Request} request - Owned payment request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Transactionally completes payment and activates/extends access.
 */
export async function simulatePaymentSuccess(request, response) {
  const result = await completePrototypePayment(
    request.user._id,
    request.params.paymentId,
  );
  response.json({ success: true, data: result });
}

/**
 * POST /api/subscriptions/payments/:paymentId/simulate-failure
 * Auth: authenticated Family owner.
 * Params: paymentId; body may contain a non-sensitive reason.
 * Success 200: failed payment; subscription remains unchanged.
 * Failure 403/404/409: disabled simulation, wrong owner, or invalid state.
 * @param {import("express").Request} request - Owned payment request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Marks one pending payment failed and creates a notification.
 */
export async function simulatePaymentFailure(request, response) {
  const payment = await finishPrototypePayment(
    request.user._id,
    request.params.paymentId,
    "failed",
    request.body?.reason || "Development simulation failure",
  );
  response.json({ success: true, data: { payment } });
}

/**
 * POST /api/subscriptions/payments/:paymentId/cancel
 * Auth: authenticated Family owner.
 * Params: paymentId; body may contain a non-sensitive reason.
 * Success 200: cancelled payment; access remains unchanged.
 * Failure 403/404/409: disabled simulation, wrong owner, or invalid state.
 * @param {import("express").Request} request - Owned payment request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Marks one caller-owned pending payment cancelled.
 */
export async function cancelPrototypePayment(request, response) {
  const payment = await finishPrototypePayment(
    request.user._id,
    request.params.paymentId,
    "cancelled",
    request.body?.reason || "Cancelled during development checkout",
  );
  response.json({ success: true, data: { payment } });
}

/**
 * PATCH /api/subscriptions/me/cancel
 * Auth: authenticated Family account.
 * Body: optional validated reason; params/query unused.
 * Success 200: cancelled subscription with immediate Core access.
 * Failure 409: no active/trialing subscription.
 * @param {import("express").Request} request - Family cancellation request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Cancels active access without deleting history or payments.
 */
export async function cancelMySubscription(request, response) {
  const subscription = await FamilySubscription.findOneAndUpdate(
    {
      family: request.user._id,
      status: { $in: ["trialing", "active"] },
    },
    {
      $set: {
        status: "cancelled",
        accessLevel: "core",
        cancelledAt: new Date(),
        cancellationReason: request.subscriptionCancellationReason,
      },
    },
    { new: true },
  );

  if (!subscription) {
    throw new ApiError(409, "There is no active subscription to cancel.");
  }

  response.json({ success: true, data: { subscription } });
}
