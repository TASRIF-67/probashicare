import { env } from "../config/env.js";
import { FamilySubscription } from "../models/FamilySubscription.js";
import { ApiError } from "../utils/ApiError.js";
import { determineSubscriptionAccess } from "./entitlementService.js";

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;

/**
 * Loads or creates the single subscription record owned by one Family account.
 * @param {string|import("mongoose").Types.ObjectId} familyUserId - Authenticated Family user ID.
 * @returns {Promise<import("mongoose").Document>} Existing or newly created FamilySubscription.
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
    // Two first requests may both observe no document. The unique family index
    // lets only one insert win. Error code 11000 means duplicate key, so the
    // losing request safely loads the document created by the winner.
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
 * Persists an elapsed trial or paid period as expired when a write is necessary.
 * @param {import("mongoose").Document} subscription - FamilySubscription document.
 * @param {Date|string|number} [nowValue=new Date()] - Synchronization clock.
 * @returns {Promise<import("mongoose").Document>} Original or newly expired subscription.
 * @sideEffects May update status, access level, and expiry-check time.
 */
export async function synchronizeSubscriptionExpiry(
  subscription,
  nowValue = new Date(),
) {
  const now = new Date(nowValue);
  const access = determineSubscriptionAccess(subscription, now);

  const statusCanExpire =
    subscription.status === "trialing" || subscription.status === "active";

  if (!statusCanExpire || access.status !== "expired") {
    return subscription;
  }

  // The stored old status and elapsed-date condition make this an atomic,
  // concurrency-safe state transition.
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

  // Another request may have renewed the record before this update. In that
  // case the conditional update returns null and the caller keeps its document.
  return expiredSubscription || subscription;
}

/**
 * Loads a Family subscription, synchronizes expiry, and calculates access.
 * @param {string|import("mongoose").Types.ObjectId} familyUserId - Authenticated Family ID.
 * @param {Date|string|number} [nowValue=new Date()] - Access calculation time.
 * @returns {Promise<{
 *   subscription: import("mongoose").Document,
 *   access: {
 *     accessLevel: string,
 *     status: string,
 *     isPremium: boolean,
 *     entitlements: string[],
 *     expiresAt: Date|null
 *   }
 * }>} Stored subscription and effective access.
 * @sideEffects Reads MongoDB, may create Core state, and may persist expiry.
 */
export async function getFamilySubscriptionAccess(
  familyUserId,
  nowValue = new Date(),
) {
  let subscription = await getOrCreateFamilySubscription(familyUserId);

  subscription = await synchronizeSubscriptionExpiry(subscription, nowValue);

  const access = determineSubscriptionAccess(subscription, nowValue);

  return {
    subscription,
    access,
  };
}

/**
 * Activates the one-time seven-day Premium trial for one Family account.
 * @param {string|import("mongoose").Types.ObjectId} familyUserId - Authenticated Family ID.
 * @param {Date|string|number} [nowValue=new Date()] - Backend-controlled activation time.
 * @returns {Promise<{subscription: import("mongoose").Document, access: object}>} Activated trial and effective access.
 * @sideEffects Creates Core state if needed and atomically writes trial dates.
 * @throws {ApiError} Returns 409 after the one-time trial has been used.
 */
export async function activateFamilyTrial(familyUserId, nowValue = new Date()) {
  const now = new Date(nowValue);

  if (Number.isNaN(now.getTime())) {
    throw new TypeError("A valid trial activation time is required.");
  }

  await getOrCreateFamilySubscription(familyUserId);

  const dayMilliseconds =
    HOURS_PER_DAY *
    MINUTES_PER_HOUR *
    SECONDS_PER_MINUTE *
    MILLISECONDS_PER_SECOND;
  const trialMilliseconds = env.familyTrialDays * dayMilliseconds;
  const trialEndsAt = new Date(now.getTime() + trialMilliseconds);

  // `trialUsed: false` is part of the atomic filter. Two concurrent requests
  // cannot both activate the one-time trial.
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
    throw new ApiError(409, "The one-time free trial has already been used.");
  }

  return {
    subscription,
    access: determineSubscriptionAccess(subscription, now),
  };
}
