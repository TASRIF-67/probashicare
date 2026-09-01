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

const MINUTES_TO_MILLISECONDS = 60 * 1000;
const MAXIMUM_REASON_LENGTH = 500;

/**
 * Creates a plain immutable snapshot from a backend plan.
 * @param {object} plan - SubscriptionPlan document.
 * @returns {{
 *   code: string,
 *   name: string,
 *   accessLevel: string,
 *   durationType: string,
 *   durationValue: number,
 *   price: number,
 *   currency: string,
 *   features: string[]
 * }} Historical plan details.
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
    // Array spread creates a new array instead of sharing the plan array.
    features: [...plan.features],
  };
}

/**
 * Generates a unique development transaction reference.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {string} Human-readable reference with random bytes.
 * @sideEffects Reads time and cryptographic randomness.
 */
export function generatePrototypeTransactionReference() {
  // Base 36 uses digits and letters, producing a shorter timestamp.
  const timePart = Date.now().toString(36).toUpperCase();

  // `randomBytes` produces unpredictable bytes. Hex converts each byte into
  // two readable hexadecimal characters.
  const randomPart = crypto.randomBytes(5).toString("hex").toUpperCase();

  return "DEV-" + timePart + "-" + randomPart;
}

/**
 * Generates a simulated gateway confirmation identifier after success.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {string} Unique development-only confirmation identifier.
 * @sideEffects Reads time and cryptographic randomness.
 */
export function generatePrototypeConfirmationReference() {
  const timePart = Date.now().toString(36).toUpperCase();
  const randomPart = crypto.randomBytes(6).toString("hex").toUpperCase();

  return "SIM-CONF-" + timePart + "-" + randomPart;
}

/**
 * Ensures payment simulation is explicitly enabled outside production.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {void}
 * @sideEffects None.
 * @throws {ApiError} Returns 403 when simulation is disabled.
 */
export function requirePrototypePaymentsEnabled() {
  const simulationIsUnavailable =
    !env.prototypePaymentsEnabled || env.nodeEnv === "production";

  if (simulationIsUnavailable) {
    throw new ApiError(403, "Prototype payment simulation is disabled.");
  }
}

/**
 * Creates one pending payment from authoritative backend plan data.
 * @param {string|import("mongoose").Types.ObjectId} familyUserId - Authenticated Family ID.
 * @param {string} planCode - Selected backend plan code.
 * @param {string} paymentMethod - Validated prototype method.
 * @returns {Promise<import("mongoose").Document>} Pending SubscriptionPayment.
 * @sideEffects Reads plans/subscription and creates one payment.
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
  const planSnapshot = createPlanSnapshot(plan);
  const transactionReference = generatePrototypeTransactionReference();

  // Price, currency, and duration come from the database plan, never the
  // frontend body. This prevents price manipulation.
  return SubscriptionPayment.create({
    family: familyUserId,
    subscription: subscription._id,
    plan: plan._id,
    planSnapshot,
    amount: plan.price,
    currency: plan.currency,
    paymentMethod,
    status: "pending",
    transactionReference,
  });
}

/**
 * Completes one owned pending payment and activates access in one transaction.
 * @param {string|import("mongoose").Types.ObjectId} familyUserId - Authenticated Family ID.
 * @param {string|import("mongoose").Types.ObjectId} paymentId - Payment ID.
 * @param {Date|string|number} [completedAtValue=new Date()] - Backend completion time.
 * @returns {Promise<{
 *   payment: import("mongoose").Document,
 *   subscription: import("mongoose").Document,
 *   alreadyCompleted: boolean
 * }>} Payment, subscription, and idempotency result.
 * @sideEffects Transactionally updates payment, subscription, and notification.
 */
export async function completePrototypePayment(
  familyUserId,
  paymentId,
  completedAtValue = new Date(),
) {
  // Step 1: Stop unless development payment simulation is enabled.
  requirePrototypePaymentsEnabled();

  // Step 2: Normalize completion time before opening the transaction.
  const completedAt = new Date(completedAtValue);
  const session = await mongoose.startSession();
  let output;

  try {
    await session.withTransaction(async () => {
      // Ownership is part of the query. `session` joins this read to the same
      // transaction used by every write below.
      // Step 3: Load the caller-owned payment inside the transaction.
      const payment = await SubscriptionPayment.findOne({
        _id: paymentId,
        family: familyUserId,
      }).session(session);

      if (!payment) {
        throw new ApiError(404, "Payment not found.");
      }

      // A repeated successful confirmation returns the previous result and must
      // never extend the subscription a second time.
      // Step 4: Make repeated success callbacks idempotent.
      if (payment.status === "completed" && payment.activationAppliedAt) {
        const subscription = await FamilySubscription.findById(
          payment.subscription,
        ).session(session);

        output = {
          payment,
          subscription,
          alreadyCompleted: true,
        };
        return;
      }

      if (payment.status !== "pending") {
        throw new ApiError(409, "Only a pending payment can be completed.");
      }

      // Step 5: Load the subscription owned by the same family.
      const subscription = await FamilySubscription.findOne({
        _id: payment.subscription,
        family: familyUserId,
      }).session(session);

      if (!subscription) {
        throw new ApiError(404, "Family subscription not found.");
      }

      let renewableExpiry = null;
      const accessCanExtend =
        subscription.status === "active" || subscription.status === "trialing";

      if (accessCanExtend) {
        renewableExpiry = subscription.currentPeriodEndsAt;
      }

      // Early renewal begins at a future expiry. Expired/new access begins now.
      // Step 6: Start now or extend from a future expiry.
      const periodStart = selectRenewalStart(completedAt, renewableExpiry);
      const planSnapshot = payment.planSnapshot;
      const periodEnd = calculateSubscriptionPeriodEnd(
        periodStart,
        planSnapshot.durationType,
        planSnapshot.durationValue,
      );

      // Step 7: Apply the authoritative plan snapshot to Premium access.
      subscription.currentPlan = payment.plan;
      subscription.accessLevel = "premium";
      subscription.status = "active";
      subscription.currentPeriodStartedAt = periodStart;
      subscription.currentPeriodEndsAt = periodEnd;
      subscription.planSnapshot = planSnapshot;
      subscription.cancelledAt = null;
      subscription.cancellationReason = "";
      subscription.lastExpiryCheckAt = completedAt;

      await subscription.save({
        session,
      });

      // Step 8: Mark the payment completed exactly once.
      payment.status = "completed";
      payment.completedAt = completedAt;

      if (!payment.confirmationReference) {
        payment.confirmationReference =
          generatePrototypeConfirmationReference();
      }

      payment.activationAppliedAt = completedAt;

      await payment.save({
        session,
      });

      // Step 9: Create one success notification in the transaction.
      const deduplicationKey = "payment:" + payment._id + ":completed";

      await Notification.updateOne(
        {
          deduplicationKey,
        },
        {
          $setOnInsert: {
            recipient: familyUserId,
            type: "payment_completed",
            title: "Prototype payment completed",
            message:
              planSnapshot.name +
              " Premium access is active. This was a development simulation.",
            actionUrl: "/subscription",
            deduplicationKey,
            metadata: {
              paymentId: payment._id,
            },
          },
        },
        {
          upsert: true,
          session,
        },
      );

      output = {
        payment,
        subscription,
        alreadyCompleted: false,
      };
    });
  } finally {
    // A session must be ended after commit, rollback, or any thrown error.
    await session.endSession();
  }

  // Step 10: Return the committed payment and subscription state.
  return output;
}

/**
 * Cancels pending simulations abandoned beyond the checkout window.
 * @param {{
 *   familyUserId?: string|import("mongoose").Types.ObjectId,
 *   now?: Date|string|number,
 *   maxAgeMinutes?: number
 * }} [options] - Optional owner, clock, and timeout.
 * @returns {Promise<number>} Number of stale payments changed to cancelled.
 * @sideEffects Bulk-updates stale pending payments.
 */
export async function expireStalePrototypePayments(options = {}) {
  const now = new Date(options.now || new Date());
  const maxAgeMinutes = options.maxAgeMinutes || 15;
  const maxAgeMilliseconds = maxAgeMinutes * MINUTES_TO_MILLISECONDS;
  const cutoff = new Date(now.getTime() - maxAgeMilliseconds);

  const filter = {
    status: "pending",
    $or: [
      {
        provider: "prototype",
      },
      {
        // Payments created before provider tracking are prototype records.
        provider: {
          $exists: false,
        },
      },
    ],
    createdAt: {
      $lte: cutoff,
    },
  };

  if (options.familyUserId) {
    filter.family = options.familyUserId;
  }

  const result = await SubscriptionPayment.updateMany(filter, {
    $set: {
      status: "cancelled",
      cancelledAt: now,
      failureReason: "Checkout expired after being abandoned.",
    },
  });

  return result.modifiedCount;
}

/**
 * Moves an owned pending payment to failed or cancelled without changing access.
 * @param {string|import("mongoose").Types.ObjectId} familyUserId - Authenticated Family ID.
 * @param {string|import("mongoose").Types.ObjectId} paymentId - Payment ID.
 * @param {"failed"|"cancelled"} status - Terminal prototype result.
 * @param {string} [reason=""] - Safe failure/cancellation reason.
 * @returns {Promise<import("mongoose").Document>} Updated payment.
 * @sideEffects Updates one payment and may create a failure notification.
 */
export async function finishPrototypePayment(
  familyUserId,
  paymentId,
  status,
  reason = "",
) {
  requirePrototypePaymentsEnabled();

  const now = new Date();

  // `String` normalizes non-string input. `trim` removes surrounding spaces,
  // and `slice` limits the stored text to the schema maximum.
  const safeReason = String(reason).trim().slice(0, MAXIMUM_REASON_LENGTH);

  const updates = {
    status,
    failureReason: safeReason,
  };

  if (status === "failed") {
    updates.failedAt = now;
  } else {
    updates.cancelledAt = now;
  }

  // The pending status in this atomic filter prevents a terminal payment from
  // being changed again.
  const payment = await SubscriptionPayment.findOneAndUpdate(
    {
      _id: paymentId,
      family: familyUserId,
      status: "pending",
    },
    {
      $set: updates,
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!payment) {
    throw new ApiError(409, "Only a pending payment can be updated.");
  }

  if (status === "failed") {
    const deduplicationKey = "payment:" + payment._id + ":failed";

    await Notification.updateOne(
      {
        deduplicationKey,
      },
      {
        $setOnInsert: {
          recipient: familyUserId,
          type: "payment_failed",
          title: "Prototype payment failed",
          message:
            "The simulated payment failed and subscription access was not changed.",
          actionUrl: "/subscription",
          deduplicationKey,
          metadata: {
            paymentId: payment._id,
          },
        },
      },
      {
        upsert: true,
      },
    );
  }

  return payment;
}
