import crypto from "node:crypto";
import mongoose from "mongoose";
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
import { getOrCreateFamilySubscription } from "./subscriptionService.js";

/**
 * Creates a plain immutable snapshot from a backend plan.
 * @param {object} plan - SubscriptionPlan document.
 * @returns {object} Plan details safe for subscription/payment history.
 * @sideEffects None.
 */
export function createPlanSnapshot(plan) {
  return {
    code: plan.code,
    name: plan.name,
    accessLevel: plan.accessLevel,
    durationType: plan.durationType,
    durationValue: plan.durationValue,
    price: plan.price,
    currency: plan.currency,
    features: [...plan.features],
  };
}

/**
 * Generates a unique development transaction reference.
 * @returns {string} Human-readable reference with random bytes.
 * @sideEffects Uses cryptographic randomness.
 */
export function generatePrototypeTransactionReference() {
  return (
    "DEV-" +
    Date.now().toString(36).toUpperCase() +
    "-" +
    crypto.randomBytes(5).toString("hex").toUpperCase()
  );
}

/**
 * Generates a simulated gateway confirmation identifier after success.
 * @returns {string} Unique development-only confirmation identifier.
 * @sideEffects Uses cryptographic randomness.
 */
export function generatePrototypeConfirmationReference() {
  return (
    "SIM-CONF-" +
    Date.now().toString(36).toUpperCase() +
    "-" +
    crypto.randomBytes(6).toString("hex").toUpperCase()
  );
}
/**
 * Ensures payment simulation is explicitly enabled.
 * @returns {void}
 * @sideEffects None.
 * @throws {ApiError} Returns 403 outside enabled development configuration.
 */
export function requirePrototypePaymentsEnabled() {
  if (!env.prototypePaymentsEnabled || env.nodeEnv === "production") {
    throw new ApiError(403, "Prototype payment simulation is disabled.");
  }
}

/**
 * Creates one pending payment using authoritative backend plan data.
 * @param {string|import("mongoose").Types.ObjectId} familyUserId - Authenticated Family ID.
 * @param {string} planCode - Selected backend plan code.
 * @param {string} paymentMethod - Approved prototype method.
 * @returns {Promise<object>} Created pending SubscriptionPayment document.
 * @sideEffects Reads plans/subscription and creates a payment in MongoDB.
 */
export async function createPrototypePayment(
  familyUserId,
  planCode,
  paymentMethod,
) {
  requirePrototypePaymentsEnabled();
  const plan = await SubscriptionPlan.findOne({
    code: planCode,
    isActive: true,
  });

  if (!plan) {
    throw new ApiError(404, "Subscription plan not found.");
  }

  const subscription = await getOrCreateFamilySubscription(familyUserId);
  const snapshot = createPlanSnapshot(plan);

  return SubscriptionPayment.create({
    family: familyUserId,
    subscription: subscription._id,
    plan: plan._id,
    planSnapshot: snapshot,
    amount: plan.price,
    currency: plan.currency,
    paymentMethod,
    status: "pending",
    transactionReference: generatePrototypeTransactionReference(),
  });
}

/**
 * Completes one owned pending payment and activates access in one transaction.
 * @param {string|import("mongoose").Types.ObjectId} familyUserId - Authenticated Family ID.
 * @param {string|import("mongoose").Types.ObjectId} paymentId - Payment ID.
 * @param {Date|string|number} [completedAtValue=new Date()] - Backend completion time.
 * @returns {Promise<{payment: object, subscription: object, alreadyCompleted: boolean}>} Updated records and idempotency flag.
 * @sideEffects Uses a MongoDB transaction to update payment, subscription, and notification.
 */
export async function completePrototypePayment(
  familyUserId,
  paymentId,
  completedAtValue = new Date(),
) {
  requirePrototypePaymentsEnabled();
  const completedAt = new Date(completedAtValue);
  const session = await mongoose.startSession();
  let output;

  try {
    await session.withTransaction(async () => {
      const payment = await SubscriptionPayment.findOne({
        _id: paymentId,
        family: familyUserId,
      }).session(session);

      if (!payment) {
        throw new ApiError(404, "Payment not found.");
      }

      if (payment.status === "completed" && payment.activationAppliedAt) {
        const subscription = await FamilySubscription.findById(
          payment.subscription,
        ).session(session);
        output = { payment, subscription, alreadyCompleted: true };
        return;
      }

      if (payment.status !== "pending") {
        throw new ApiError(409, "Only a pending payment can be completed.");
      }

      const subscription = await FamilySubscription.findOne({
        _id: payment.subscription,
        family: familyUserId,
      }).session(session);

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

      subscription.currentPlan = payment.plan;
      subscription.accessLevel = "premium";
      subscription.status = "active";
      subscription.currentPeriodStartedAt = start;
      subscription.currentPeriodEndsAt = end;
      subscription.planSnapshot = snapshot;
      subscription.cancelledAt = null;
      subscription.cancellationReason = "";
      subscription.lastExpiryCheckAt = completedAt;
      await subscription.save({ session });

      payment.status = "completed";
      payment.completedAt = completedAt;
      payment.confirmationReference =
        payment.confirmationReference || generatePrototypeConfirmationReference();
      payment.activationAppliedAt = completedAt;
      await payment.save({ session });

      await Notification.updateOne(
        {
          deduplicationKey: "payment:" + payment._id + ":completed",
        },
        {
          $setOnInsert: {
            recipient: familyUserId,
            type: "payment_completed",
            title: "Prototype payment completed",
            message:
              snapshot.name +
              " Premium access is active. This was a development simulation.",
            actionUrl: "/subscription",
            metadata: { paymentId: payment._id },
          },
        },
        { upsert: true, session },
      );

      output = { payment, subscription, alreadyCompleted: false };
    });
  } finally {
    await session.endSession();
  }

  return output;
}

/**
 * Cancels pending simulations abandoned beyond the checkout window.
 * @param {{familyUserId?: string|import("mongoose").Types.ObjectId, now?: Date|string|number, maxAgeMinutes?: number}} [options] - Optional owner, clock, and timeout.
 * @returns {Promise<number>} Number of stale payments changed to cancelled.
 * @sideEffects Updates stale pending payments in MongoDB.
 */
export async function expireStalePrototypePayments(options = {}) {
  const now = new Date(options.now || new Date());
  const maxAgeMinutes = options.maxAgeMinutes || 15;
  const cutoff = new Date(now.getTime() - maxAgeMinutes * 60 * 1000);
  const filter = {
    status: "pending",
    createdAt: { $lte: cutoff },
  };

  if (options.familyUserId) {
    filter.family = options.familyUserId;
  }

  const result = await SubscriptionPayment.updateMany(
    filter,
    {
      $set: {
        status: "cancelled",
        cancelledAt: now,
        failureReason: "Checkout expired after being abandoned.",
      },
    },
  );

  return result.modifiedCount;
}
/**
 * Moves an owned pending payment to failed or cancelled without changing access.
 * @param {string|import("mongoose").Types.ObjectId} familyUserId - Authenticated Family ID.
 * @param {string|import("mongoose").Types.ObjectId} paymentId - Payment ID.
 * @param {"failed"|"cancelled"} status - Terminal prototype result.
 * @param {string} [reason=""] - Safe development failure/cancellation reason.
 * @returns {Promise<object>} Updated payment document.
 * @sideEffects Updates one pending payment and may create a failure notification.
 */
export async function finishPrototypePayment(
  familyUserId,
  paymentId,
  status,
  reason = "",
) {
  requirePrototypePaymentsEnabled();
  const now = new Date();
  const updates = {
    status,
    failureReason: String(reason).trim().slice(0, 500),
  };

  if (status === "failed") {
    updates.failedAt = now;
  } else {
    updates.cancelledAt = now;
  }

  const payment = await SubscriptionPayment.findOneAndUpdate(
    { _id: paymentId, family: familyUserId, status: "pending" },
    { $set: updates },
    { new: true, runValidators: true },
  );

  if (!payment) {
    throw new ApiError(409, "Only a pending payment can be updated.");
  }

  if (status === "failed") {
    await Notification.updateOne(
      { deduplicationKey: "payment:" + payment._id + ":failed" },
      {
        $setOnInsert: {
          recipient: familyUserId,
          type: "payment_failed",
          title: "Prototype payment failed",
          message:
            "The simulated payment failed and subscription access was not changed.",
          actionUrl: "/subscription",
          metadata: { paymentId: payment._id },
        },
      },
      { upsert: true },
    );
  }

  return payment;
}
