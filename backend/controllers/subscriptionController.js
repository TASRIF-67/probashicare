import { FamilySubscription } from "../models/FamilySubscription.js";
import { SubscriptionPayment } from "../models/SubscriptionPayment.js";
import { SubscriptionPlan } from "../models/SubscriptionPlan.js";
import { ApiError } from "../utils/ApiError.js";
import { env } from "../config/env.js";
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
import {
  cancelOwnedStripeCheckout,
  createStripeCheckoutSession,
  getStripeCheckoutStatus,
} from "../services/stripePaymentService.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAXIMUM_LIMIT = 100;

/**
 * Converts a query value into a bounded positive integer.
 * @param {unknown} value - Query-string value.
 * @param {number} fallback - Value used for absent/invalid input.
 * @param {number|null} maximum - Optional upper limit.
 * @returns {number} Safe page or limit number.
 * @sideEffects None.
 */
function readPositiveInteger(value, fallback, maximum = null) {
  // `Number.parseInt` reads a base-ten integer from query text.
  const parsedValue = Number.parseInt(value, 10);
  let safeValue = Math.max(1, parsedValue || fallback);

  if (maximum !== null) {
    safeValue = Math.min(maximum, safeValue);
  }

  return safeValue;
}

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
  const activePlanFilter = {
    isActive: true,
  };
  const priceOrder = {
    price: 1,
  };

  let plans = await SubscriptionPlan.find(activePlanFilter)
    .sort(priceOrder)
    .lean();

  if (plans.length === 0) {
    // A new database can self-seed its backend-controlled catalog.
    await synchronizeSubscriptionPlans();

    plans = await SubscriptionPlan.find(activePlanFilter)
      .sort(priceOrder)
      .lean();
  }

  const prototypeEnabled =
    env.prototypePaymentsEnabled && env.nodeEnv !== "production";

  let stripeMode = "disabled";

  if (env.stripePaymentsEnabled) {
    stripeMode = "test";
  }

  response.json({
    success: true,
    data: {
      plans,
      paymentOptions: {
        stripeEnabled: env.stripePaymentsEnabled,
        prototypeEnabled,
        stripeMode,
      },
    },
  });
}

/**
 * POST /api/subscriptions/stripe/checkout
 * Auth: authenticated Family account.
 * Body: validated planCode only; prices and duration come from MongoDB.
 * Success 201: caller-owned payment plus a Stripe-hosted test Checkout URL.
 * Failure 404/422/502/503: plan, input, Stripe API, or configuration error.
 * @param {import("express").Request} request - Validated Family request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Creates a pending payment and a Stripe Checkout Session.
 */
export async function createStripeCheckout(request, response) {
  const result = await createStripeCheckoutSession(
    request.user._id,
    request.user.email,
    request.stripeCheckoutInput.planCode,
  );
  response.status(201).json({ success: true, data: result });
}

/**
 * GET /api/subscriptions/stripe/checkouts/:sessionId
 * Auth: authenticated Family owner.
 * Params: Stripe Checkout Session ID; body/query unused.
 * Success 200: caller-owned local payment status.
 * Failure 404: the Session is not linked to the authenticated Family.
 * @param {import("express").Request} request - Family status request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads caller-owned payment state from MongoDB.
 */
export async function getMyStripeCheckoutStatus(request, response) {
  const payment = await getStripeCheckoutStatus(
    request.user._id,
    String(request.params.sessionId || "").trim(),
  );
  response.json({ success: true, data: { payment } });
}

/**
 * POST /api/subscriptions/stripe/payments/:paymentId/cancel
 * Auth: authenticated Family owner.
 * Params: validated local payment ID; body/query unused.
 * Success 200: cancelled or already-terminal payment.
 * Failure 404/409/503: wrong owner, closed Checkout, or disabled Stripe.
 * @param {import("express").Request} request - Family cancellation request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Expires an open Stripe Session and updates its local payment.
 */
export async function cancelStripeCheckout(request, response) {
  const payment = await cancelOwnedStripeCheckout(
    request.user._id,
    request.params.paymentId,
  );
  response.json({ success: true, data: { payment } });
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
  // Step 1: Convert abandoned prototype checkouts before showing history so
  // the page never displays a stale pending state.
  await expireStalePrototypePayments({
    familyUserId: request.user._id,
  });

  // Step 2: Convert optional query strings into safe bounded numbers.
  const page = readPositiveInteger(request.query.page, DEFAULT_PAGE);
  const limit = readPositiveInteger(
    request.query.limit,
    DEFAULT_LIMIT,
    MAXIMUM_LIMIT,
  );
  const filter = {
    // Ownership always comes from the authenticated session, never the body.
    family: request.user._id,
  };

  // Step 3: Build (but do not execute yet) the page and count queries.
  // `skip` ignores every record belonging to earlier pages.
  const paymentsPromise = SubscriptionPayment.find(filter)
    .sort({
      createdAt: -1,
    })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();
  const totalPromise = SubscriptionPayment.countDocuments(filter);

  // The page and count queries are independent and can run concurrently.
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
  let reason = "Development simulation failure";

  if (request.body?.reason) {
    reason = request.body.reason;
  }

  const payment = await finishPrototypePayment(
    request.user._id,
    request.params.paymentId,
    "failed",
    reason,
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
  let reason = "Cancelled during development checkout";

  if (request.body?.reason) {
    reason = request.body.reason;
  }

  const payment = await finishPrototypePayment(
    request.user._id,
    request.params.paymentId,
    "cancelled",
    reason,
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
  // This one atomic operation both verifies ownership/current state and writes
  // the cancellation. `$in` permits trialing or active, while `$set` changes
  // only the named fields. `new: true` returns the cancelled document.
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
