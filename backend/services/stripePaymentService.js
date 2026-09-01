import crypto from "node:crypto";
import mongoose from "mongoose";
import Stripe from "stripe";
import { env } from "../config/env.js";
import { FamilySubscription } from "../models/FamilySubscription.js";
import { Notification } from "../models/Notification.js";
import { SubscriptionPayment } from "../models/SubscriptionPayment.js";
import { SubscriptionPlan } from "../models/SubscriptionPlan.js";
import { ApiError } from "../utils/ApiError.js";
import {
  calculateSubscriptionPeriodEnd,
  selectRenewalStart,
} from "../utils/subscriptionPeriod.js";
import { createPlanSnapshot } from "./prototypePaymentService.js";
import { getOrCreateFamilySubscription } from "./subscriptionService.js";

// The module keeps one lazily created SDK client. It is not created during
// import, which allows tests and deployments with Stripe disabled to start.
let stripeClient = null;

/**
 * Ensures the Stripe test integration is intentionally enabled and configured.
 * @returns {void}
 * @sideEffects Throws an operational error when Stripe cannot be used.
 */
export function requireStripePaymentsEnabled() {
  if (
    !env.stripePaymentsEnabled ||
    !env.stripeSecretKey ||
    !env.stripeWebhookSecret
  ) {
    throw new ApiError(
      503,
      "Stripe sandbox payments are not configured on this server.",
    );
  }
}

/**
 * Returns one reusable Stripe SDK client configured with the backend secret.
 * @returns {Stripe} Configured Stripe API client.
 * @sideEffects Creates the client during its first call.
 */
function getStripeClient() {
  requireStripePaymentsEnabled();

  if (!stripeClient) {
    stripeClient = new Stripe(env.stripeSecretKey);
  }

  return stripeClient;
}

/**
 * Converts a BDT plan price to Stripe's two-decimal minor-unit amount.
 * @param {number} amount - Positive BDT amount stored by the backend.
 * @returns {number} Integer amount in poisha for the Stripe API.
 * @sideEffects None.
 */
export function convertBdtToStripeMinorUnits(amount) {
  // `Number` converts a numeric string/value into a JavaScript number.
  const numericAmount = Number(amount);

  // Stripe expects the smallest currency unit as an integer. `Math.round`
  // prevents floating-point fractions from reaching the provider.
  const minorUnits = Math.round(numericAmount * 100);

  if (!Number.isFinite(numericAmount) || minorUnits < 1) {
    throw new ApiError(422, "The selected plan has an invalid payment amount.");
  }

  return minorUnits;
}

/**
 * Generates a local transaction reference before Stripe creates its Session.
 * @returns {string} Unique human-readable Stripe sandbox reference.
 * @sideEffects Uses the current time and cryptographic randomness.
 */
function generateStripeTransactionReference() {
  const timePart = Date.now().toString(36).toUpperCase();
  const randomPart = crypto.randomBytes(5).toString("hex").toUpperCase();
  return "STRIPE-TEST-" + timePart + "-" + randomPart;
}

/**
 * Creates a pending local payment and a Stripe-hosted test Checkout Session.
 * @param {string|import("mongoose").Types.ObjectId} familyUserId - Authenticated Family ID.
 * @param {string} familyEmail - Authenticated Family email for Checkout.
 * @param {string} planCode - Backend-controlled subscription plan code.
 * @returns {Promise<object>} Local payment and hosted Checkout details.
 * @sideEffects Reads MongoDB, creates a payment, and calls Stripe's test API.
 */
export async function createStripeCheckoutSession(
  familyUserId,
  familyEmail,
  planCode,
) {
  const stripe = getStripeClient();
  const plan = await SubscriptionPlan.findOne({
    code: planCode,
    isActive: true,
  });

  if (!plan) {
    throw new ApiError(404, "Subscription plan not found.");
  }

  const subscription = await getOrCreateFamilySubscription(familyUserId);
  const planSnapshot = createPlanSnapshot(plan);
  const payment = await SubscriptionPayment.create({
    family: familyUserId,
    subscription: subscription._id,
    plan: plan._id,
    planSnapshot,
    amount: plan.price,
    currency: plan.currency,
    paymentMethod: "stripe_checkout",
    provider: "stripe",
    status: "pending",
    transactionReference: generateStripeTransactionReference(),
  });

  try {
    // Stripe replaces the CHECKOUT_SESSION_ID placeholder after payment.
    const successUrl =
      env.clientUrl +
      "/subscription?stripe=success&session_id={CHECKOUT_SESSION_ID}";
    const cancelUrl =
      env.clientUrl +
      "/subscription?stripe=cancelled&payment_id=" +
      payment._id;

    // Only trusted backend plan values are sent to Stripe.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: familyEmail || undefined,
      client_reference_id: String(payment._id),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: plan.currency.toLowerCase(),
            unit_amount: convertBdtToStripeMinorUnits(plan.price),
            product_data: {
              name: "ProbashiCare " + plan.name + " Premium access",
              description: plan.description,
            },
          },
        },
      ],
      metadata: {
        paymentId: String(payment._id),
        familyUserId: String(familyUserId),
        planCode: plan.code,
      },
      payment_intent_data: {
        metadata: {
          paymentId: String(payment._id),
          familyUserId: String(familyUserId),
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Stripe expects Unix seconds, while Date.now returns milliseconds.
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });

    if (!session.url) {
      throw new Error("Stripe did not return a Checkout URL.");
    }

    payment.stripeCheckoutSessionId = session.id;
    await payment.save();

    return {
      payment,
      checkoutUrl: session.url,
      sessionId: session.id,
    };
  } catch (error) {
    payment.status = "failed";
    payment.failedAt = new Date();
    // `String` normalizes unknown error values and `slice` obeys the schema
    // maximum without returning provider secrets to the client.
    payment.failureReason = String(error.message || "Stripe API error").slice(
      0,
      500,
    );
    await payment.save();
    throw new ApiError(
      502,
      "Stripe Checkout could not be started. Please try again.",
    );
  }
}

/**
 * Checks provider totals against the immutable backend payment snapshot.
 * @param {object} checkoutSession - Stripe Checkout Session from a signed event.
 * @param {object} payment - Pending local SubscriptionPayment document.
 * @returns {void}
 * @sideEffects Throws when provider details do not match local records.
 */
export function validateStripeCheckoutPayment(checkoutSession, payment) {
  const expectedAmount = convertBdtToStripeMinorUnits(payment.amount);
  const receivedCurrency = String(checkoutSession.currency || "").toUpperCase();

  if (checkoutSession.payment_status !== "paid") {
    throw new ApiError(409, "Stripe has not marked this Checkout as paid.");
  }

  if (checkoutSession.amount_total !== expectedAmount) {
    throw new ApiError(409, "Stripe payment amount did not match the plan.");
  }

  if (receivedCurrency !== payment.currency) {
    throw new ApiError(409, "Stripe payment currency did not match the plan.");
  }
}

/**
 * Activates or extends Premium after a verified paid Stripe Checkout event.
 * @param {object} checkoutSession - Paid Stripe Checkout Session.
 * @param {string} stripeEventId - Signed Stripe event identifier.
 * @param {Date|string|number} [completedAtValue=new Date()] - Completion time.
 * @returns {Promise<{payment: object, subscription: object, alreadyCompleted: boolean}>} Updated records.
 * @sideEffects Transactionally updates payment, subscription, and notification.
 */
export async function completeStripeCheckoutPayment(
  checkoutSession,
  stripeEventId,
  completedAtValue = new Date(),
) {
  // Optional chaining safely reads signed provider metadata that may be absent.
  const paymentId = checkoutSession.metadata?.paymentId;
  const familyUserId = checkoutSession.metadata?.familyUserId;

  const paymentIdIsValid = mongoose.isValidObjectId(paymentId);
  const familyIdIsValid = mongoose.isValidObjectId(familyUserId);

  if (!paymentIdIsValid || !familyIdIsValid) {
    throw new ApiError(409, "Stripe Checkout metadata is invalid.");
  }

  const completedAt = new Date(completedAtValue);
  const mongoSession = await mongoose.startSession();
  let output;

  try {
    // Payment, access activation, and notification are one business action.
    // Passing mongoSession to every operation makes them commit or roll back
    // together.
    await mongoSession.withTransaction(async () => {
      const payment = await SubscriptionPayment.findOne({
        _id: paymentId,
        family: familyUserId,
        provider: "stripe",
        stripeCheckoutSessionId: checkoutSession.id,
      }).session(mongoSession);

      if (!payment) {
        throw new ApiError(404, "Stripe payment record not found.");
      }

      validateStripeCheckoutPayment(checkoutSession, payment);

      // Stripe can deliver the same signed event more than once. This local
      // idempotency guard prevents extending access twice.
      if (payment.status === "completed" && payment.activationAppliedAt) {
        const subscription = await FamilySubscription.findById(
          payment.subscription,
        ).session(mongoSession);
        output = { payment, subscription, alreadyCompleted: true };
        return;
      }

      if (payment.status !== "pending") {
        throw new ApiError(409, "Only a pending Stripe payment can complete.");
      }

      const subscription = await FamilySubscription.findOne({
        _id: payment.subscription,
        family: familyUserId,
      }).session(mongoSession);

      if (!subscription) {
        throw new ApiError(404, "Family subscription not found.");
      }

      let renewableExpiry = null;

      if (
        subscription.status === "active" ||
        subscription.status === "trialing"
      ) {
        renewableExpiry = subscription.currentPeriodEndsAt;
      }

      const start = selectRenewalStart(completedAt, renewableExpiry);
      const snapshot = payment.planSnapshot;
      const end = calculateSubscriptionPeriodEnd(
        start,
        snapshot.durationType,
        snapshot.durationValue,
      );
      // Some Checkout modes expose a PaymentIntent. Falling back to Session ID
      // still gives the sandbox payment one stable confirmation reference.
      const paymentIntentId = String(
        checkoutSession.payment_intent || checkoutSession.id,
      );

      subscription.currentPlan = payment.plan;
      subscription.accessLevel = "premium";
      subscription.status = "active";
      subscription.currentPeriodStartedAt = start;
      subscription.currentPeriodEndsAt = end;
      subscription.planSnapshot = snapshot;
      subscription.cancelledAt = null;
      subscription.cancellationReason = "";
      subscription.lastExpiryCheckAt = completedAt;
      await subscription.save({ session: mongoSession });

      payment.status = "completed";
      payment.completedAt = completedAt;
      payment.confirmationReference = paymentIntentId;
      payment.stripePaymentIntentId = paymentIntentId;
      payment.stripeEventId = stripeEventId;
      payment.activationAppliedAt = completedAt;
      await payment.save({ session: mongoSession });

      const deduplicationKey = "payment:" + payment._id + ":completed";

      await Notification.updateOne(
        {
          deduplicationKey,
        },
        {
          $setOnInsert: {
            recipient: familyUserId,
            type: "payment_completed",
            title: "Stripe test payment completed",
            message:
              snapshot.name +
              " Premium access is active after a verified Stripe sandbox payment.",
            actionUrl: "/subscription",
            deduplicationKey,
            metadata: {
              paymentId: payment._id,
              stripeCheckoutSessionId: checkoutSession.id,
            },
          },
        },
        { upsert: true, session: mongoSession },
      );

      output = { payment, subscription, alreadyCompleted: false };
    });
  } finally {
    await mongoSession.endSession();
  }

  return output;
}

/**
 * Marks an expired or failed Stripe Checkout without changing Premium access.
 * @param {object} checkoutSession - Stripe Session from a signed event.
 * @param {"failed"|"cancelled"} status - Terminal local payment state.
 * @param {string} stripeEventId - Signed Stripe event identifier.
 * @param {string} reason - Safe failure explanation.
 * @returns {Promise<object|null>} Updated or already-terminal payment.
 * @sideEffects Updates MongoDB and may create a failure notification.
 */
async function finishStripeCheckout(
  checkoutSession,
  status,
  stripeEventId,
  reason,
) {
  const paymentId = checkoutSession.metadata?.paymentId;
  const filter = {
    provider: "stripe",
    stripeCheckoutSessionId: checkoutSession.id,
  };

  if (mongoose.isValidObjectId(paymentId)) {
    filter._id = paymentId;
  }

  const now = new Date();
  const updates = {
    status,
    stripeEventId,
    failureReason: reason,
  };

  if (status === "failed") {
    updates.failedAt = now;
  } else {
    updates.cancelledAt = now;
  }

  // Object spread copies the provider/session filter and adds the pending
  // state condition. The update is therefore atomic.
  const pendingFilter = {
    ...filter,
    status: "pending",
  };

  let payment = await SubscriptionPayment.findOneAndUpdate(
    pendingFilter,
    {
      $set: updates,
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!payment) {
    payment = await SubscriptionPayment.findOne(filter);
  }

  if (payment && status === "failed") {
    const deduplicationKey = "payment:" + payment._id + ":failed";

    await Notification.updateOne(
      {
        deduplicationKey,
      },
      {
        $setOnInsert: {
          recipient: payment.family,
          type: "payment_failed",
          title: "Stripe test payment failed",
          message:
            "Stripe could not complete the test payment. Premium access was not changed.",
          actionUrl: "/subscription",
          deduplicationKey,
          metadata: {
            paymentId: payment._id,
          },
        },
      },
      { upsert: true },
    );
  }

  return payment;
}

/**
 * Verifies a raw webhook body with the Stripe endpoint signing secret.
 * @param {Buffer} rawBody - Unparsed HTTP request body.
 * @param {string|undefined} signature - Stripe-Signature header.
 * @returns {Stripe.Event} Cryptographically verified Stripe event.
 * @sideEffects Uses Stripe's SDK verification helper.
 */
export function constructStripeWebhookEvent(rawBody, signature) {
  const stripe = getStripeClient();

  if (!signature) {
    throw new ApiError(400, "Stripe webhook signature is missing.");
  }

  try {
    // Stripe verifies the signature against the exact raw request bytes. JSON
    // parsing before this call would change the bytes and fail verification.
    return stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.stripeWebhookSecret,
    );
  } catch (_error) {
    throw new ApiError(400, "Stripe webhook signature verification failed.");
  }
}

/**
 * Applies the supported Stripe Checkout webhook event to local records.
 * @param {Stripe.Event} event - Verified Stripe event.
 * @returns {Promise<object|null>} Updated payment result or null when ignored.
 * @sideEffects May update payment, subscription, and notification documents.
 */
export async function processStripeWebhookEvent(event) {
  if (event.type === "checkout.session.completed") {
    return completeStripeCheckoutPayment(event.data.object, event.id);
  }

  if (event.type === "checkout.session.expired") {
    return finishStripeCheckout(
      event.data.object,
      "cancelled",
      event.id,
      "Stripe Checkout expired before payment.",
    );
  }

  if (event.type === "checkout.session.async_payment_failed") {
    return finishStripeCheckout(
      event.data.object,
      "failed",
      event.id,
      "Stripe reported that the payment failed.",
    );
  }

  return null;
}

/**
 * Loads one caller-owned Stripe payment by Checkout Session ID.
 * @param {string|import("mongoose").Types.ObjectId} familyUserId - Authenticated Family ID.
 * @param {string} checkoutSessionId - Stripe Checkout Session identifier.
 * @returns {Promise<object>} Owned payment document.
 * @sideEffects Reads MongoDB.
 */
export async function getStripeCheckoutStatus(familyUserId, checkoutSessionId) {
  const payment = await SubscriptionPayment.findOne({
    family: familyUserId,
    provider: "stripe",
    stripeCheckoutSessionId: checkoutSessionId,
  }).lean();

  if (!payment) {
    throw new ApiError(404, "Stripe payment record not found.");
  }

  return payment;
}

/**
 * Expires an open Stripe Session after the Family returns through Cancel.
 * @param {string|import("mongoose").Types.ObjectId} familyUserId - Authenticated Family ID.
 * @param {string|import("mongoose").Types.ObjectId} paymentId - Owned local payment ID.
 * @returns {Promise<object>} Cancelled or already-terminal payment.
 * @sideEffects Calls Stripe and updates the local payment.
 */
export async function cancelOwnedStripeCheckout(familyUserId, paymentId) {
  const stripe = getStripeClient();
  const payment = await SubscriptionPayment.findOne({
    _id: paymentId,
    family: familyUserId,
    provider: "stripe",
  });

  if (!payment) {
    throw new ApiError(404, "Stripe payment record not found.");
  }

  if (payment.status !== "pending") {
    // Cancellation is idempotent for a payment already completed/cancelled.
    return payment;
  }

  try {
    await stripe.checkout.sessions.expire(payment.stripeCheckoutSessionId);
  } catch (_error) {
    throw new ApiError(409, "This Stripe Checkout can no longer be cancelled.");
  }

  payment.status = "cancelled";
  payment.cancelledAt = new Date();
  payment.failureReason = "Cancelled after returning from Stripe Checkout.";
  await payment.save();
  return payment;
}
