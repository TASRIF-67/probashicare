import { env } from "../config/env.js";
import { FamilySubscription } from "../models/FamilySubscription.js";
import { ApiError } from "../utils/ApiError.js";
import { determineSubscriptionAccess } from "./entitlementService.js";

/**
 * Loads or creates the single subscription record owned by one Family account.
 * @param {string|import("mongoose").Types.ObjectId} familyUserId - Authenticated Family user ID.
 * @returns {Promise<object>} Existing or newly created FamilySubscription document.
 * @sideEffects Reads MongoDB and may create one Core subscription record.
 * @throws {Error} Propagates unexpected MongoDB failures.
 */
export async function getOrCreateFamilySubscription(familyUserId) {
  let subscription = await FamilySubscription.findOne({
    family: familyUserId,
  });

  if (subscription) {
    return subscription;
  }

  try {
    subscription = await FamilySubscription.create({
      family: familyUserId,
    });
  } catch (error) {
    if (error && error.code === 11000) {
      subscription = await FamilySubscription.findOne({
        family: familyUserId,
      });
    } else {
      throw error;
    }
  }

  return subscription;
}

/**
 * Marks an elapsed trial or paid period expired only when a write is necessary.
 * @param {object} subscription - FamilySubscription Mongoose document.
 * @param {Date|string|number} [nowValue=new Date()] - Time used for synchronization.
 * @returns {Promise<object>} Original or newly expired subscription document.
 * @sideEffects May update status, access level, and expiry-check time in MongoDB.
 * @throws {Error} Propagates MongoDB update failures.
 */
export async function synchronizeSubscriptionExpiry(
  subscription,
  nowValue = new Date(),
) {
  const now = new Date(nowValue);
  const access = determineSubscriptionAccess(subscription, now);
  const canExpire =
    subscription.status === "trialing" ||
    subscription.status === "active";

  if (!canExpire || access.status !== "expired") {
    return subscription;
  }

  const expiredSubscription = await FamilySubscription.findOneAndUpdate(
    {
      _id: subscription._id,
      status: subscription.status,
      currentPeriodEndsAt: {
        $lte: now,
      },
    },
    {
      $set: {
        status: "expired",
        accessLevel: "core",
        lastExpiryCheckAt: now,
      },
    },
    {
      new: true,
    },
  );

  return expiredSubscription || subscription;
}

/**
 * Loads the Family subscription, synchronizes expiry, and returns effective access.
 * @param {string|import("mongoose").Types.ObjectId} familyUserId - Authenticated Family user ID.
 * @param {Date|string|number} [nowValue=new Date()] - Time used for access calculation.
 * @returns {Promise<{subscription: object, access: {accessLevel: string, status: string, isPremium: boolean, entitlements: string[], expiresAt: Date|null}}>} Subscription document and effective access.
 * @sideEffects Reads MongoDB, may create a record, and may persist an expired status.
 */
export async function getFamilySubscriptionAccess(
  familyUserId,
  nowValue = new Date(),
) {
  let subscription = await getOrCreateFamilySubscription(familyUserId);
  subscription = await synchronizeSubscriptionExpiry(subscription, nowValue);

  return {
    subscription,
    access: determineSubscriptionAccess(subscription, nowValue),
  };
}

/**
 * Activates the one-time seven-day Premium trial for one Family account.
 * @param {string|import("mongoose").Types.ObjectId} familyUserId - Authenticated Family user ID.
 * @param {Date|string|number} [nowValue=new Date()] - Backend-controlled activation time.
 * @returns {Promise<{subscription: object, access: object}>} Activated subscription and Premium access.
 * @sideEffects Creates a record if needed and atomically writes trial dates/status.
 * @throws {ApiError} Returns 409 when the Family trial was already used.
 */
export async function activateFamilyTrial(
  familyUserId,
  nowValue = new Date(),
) {
  const now = new Date(nowValue);

  if (Number.isNaN(now.getTime())) {
    throw new TypeError("A valid trial activation time is required.");
  }

  await getOrCreateFamilySubscription(familyUserId);

  const trialMilliseconds =
    env.familyTrialDays * 24 * 60 * 60 * 1000;
  const trialEndsAt = new Date(now.getTime() + trialMilliseconds);
  const subscription = await FamilySubscription.findOneAndUpdate(
    {
      family: familyUserId,
      trialUsed: false,
    },
    {
      $set: {
        accessLevel: "premium",
        status: "trialing",
        trialUsed: true,
        trialStartedAt: now,
        trialEndsAt,
        currentPeriodStartedAt: now,
        currentPeriodEndsAt: trialEndsAt,
        currentPlan: null,
        planSnapshot: null,
        cancelledAt: null,
        cancellationReason: "",
        lastExpiryCheckAt: now,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!subscription) {
    throw new ApiError(
      409,
      "The one-time free trial has already been used.",
    );
  }

  return {
    subscription,
    access: determineSubscriptionAccess(subscription, now),
  };
}
