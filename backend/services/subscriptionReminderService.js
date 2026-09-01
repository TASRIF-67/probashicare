import { Notification } from "../models/Notification.js";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Selects reminder thresholds for the current subscription type.
 * @param {object} subscription - FamilySubscription document.
 * @returns {{key: string, milliseconds: number, label: string}[]} Ordered thresholds.
 * @sideEffects None.
 */
export function getReminderThresholds(subscription) {
  if (subscription.status === "trialing") {
    return [
      {
        key: "2d",
        milliseconds: 2 * DAY_MS,
        label: "2 days",
      },
      {
        key: "1d",
        milliseconds: DAY_MS,
        label: "1 day",
      },
    ];
  }

  // Optional chaining returns undefined for subscriptions without a snapshot.
  const planCode = subscription.planSnapshot?.code;

  if (planCode === "day_pass") {
    return [
      {
        key: "2h",
        milliseconds: 2 * HOUR_MS,
        label: "2 hours",
      },
      {
        key: "30m",
        milliseconds: 30 * MINUTE_MS,
        label: "30 minutes",
      },
    ];
  }

  return [
    {
      key: "7d",
      milliseconds: 7 * DAY_MS,
      label: "7 days",
    },
    {
      key: "3d",
      milliseconds: 3 * DAY_MS,
      label: "3 days",
    },
    {
      key: "1d",
      milliseconds: DAY_MS,
      label: "1 day",
    },
  ];
}

/**
 * Creates or reuses the expired-access notification for one period.
 * @param {object} subscription - FamilySubscription document.
 * @param {Date} expiry - Exact period expiry.
 * @param {string} periodKey - ISO expiry identity.
 * @returns {Promise<import("mongoose").Document>} Expiry notification.
 * @sideEffects Upserts one Notification document.
 */
async function createExpiryNotification(subscription, expiry, periodKey) {
  const deduplicationKey =
    "subscription:" + subscription.family + ":" + periodKey + ":expired";

  return Notification.findOneAndUpdate(
    {
      deduplicationKey,
    },
    {
      $setOnInsert: {
        recipient: subscription.family,
        type: "subscription_expired",
        title: "Subscription expired",
        message:
          "Premium access has ended. Existing care history and bookings remain available.",
        actionUrl: "/subscription",
        deduplicationKey,
        metadata: {
          periodEndsAt: expiry,
        },
      },
    },
    {
      upsert: true,
      new: true,
    },
  );
}

/**
 * Creates or reuses one threshold reminder.
 * @param {object} subscription - FamilySubscription document.
 * @param {{key: string, milliseconds: number, label: string}} threshold - Due threshold.
 * @param {Date} expiry - Exact period expiry.
 * @param {string} periodKey - ISO expiry identity.
 * @returns {Promise<import("mongoose").Document>} Reminder notification.
 * @sideEffects Upserts one Notification document.
 */
async function createThresholdReminder(
  subscription,
  threshold,
  expiry,
  periodKey,
) {
  let type = "subscription_expiring";

  if (subscription.status === "trialing") {
    type = "trial_expiring";
  }

  const deduplicationKey =
    "subscription:" +
    subscription.family +
    ":" +
    periodKey +
    ":" +
    threshold.key;

  return Notification.findOneAndUpdate(
    {
      deduplicationKey,
    },
    {
      $setOnInsert: {
        recipient: subscription.family,
        type,
        title: "Premium access expires soon",
        message:
          "Your Premium access expires in approximately " +
          threshold.label +
          ". Renew to keep Premium tools available.",
        actionUrl: "/subscription",
        deduplicationKey,
        metadata: {
          threshold: threshold.key,
          periodEndsAt: expiry,
        },
      },
    },
    {
      upsert: true,
      new: true,
    },
  );
}

/**
 * Creates at most one due reminder for each threshold and one expiry notice.
 * @param {object} subscription - Current FamilySubscription document.
 * @param {Date|string|number} [nowValue=new Date()] - Evaluation time.
 * @returns {Promise<object|null>} Nearest due reminder or expiry notification.
 * @sideEffects Upserts deduplicated Notification documents in MongoDB.
 */
export async function synchronizeSubscriptionReminders(
  subscription,
  nowValue = new Date(),
) {
  // Execution sequence:
  // 1. Stop for records without an expiry or outside active/trial status.
  // 2. Calculate remaining time and select plan-specific thresholds.
  // 3. Create stable, idempotent reminder or expiry notifications.
  if (!subscription.currentPeriodEndsAt) {
    return null;
  }

  const now = new Date(nowValue);
  const expiry = new Date(subscription.currentPeriodEndsAt);
  const remainingMilliseconds = expiry.getTime() - now.getTime();

  // `toISOString` gives the same identity for the same exact period end.
  const periodKey = expiry.toISOString();

  if (remainingMilliseconds <= 0) {
    return createExpiryNotification(subscription, expiry, periodKey);
  }

  const thresholds = getReminderThresholds(subscription);
  let nearestReminder = null;

  for (const threshold of thresholds) {
    if (remainingMilliseconds <= threshold.milliseconds) {
      // Thresholds are ordered from larger to smaller. Reassigning means the
      // returned reminder is the nearest due threshold reached in this loop.
      nearestReminder = await createThresholdReminder(
        subscription,
        threshold,
        expiry,
        periodKey,
      );
    }
  }

  return nearestReminder;
}

/*
 * Current behavior is request-driven: getMySubscription calls this service.
 * A production cron/worker could scan due subscriptions and call the same
 * function, but no background scheduler is started by this module.
 */
