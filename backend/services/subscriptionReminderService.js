import { Notification } from "../models/Notification.js";

/**
 * Selects reminder thresholds for the current subscription type.
 * @param {object} subscription - FamilySubscription document.
 * @returns {{key: string, milliseconds: number, label: string}[]} Ordered thresholds.
 * @sideEffects None.
 */
export function getReminderThresholds(subscription) {
  if (subscription.status === "trialing") {
    return [
      { key: "2d", milliseconds: 2 * 24 * 60 * 60 * 1000, label: "2 days" },
      { key: "1d", milliseconds: 24 * 60 * 60 * 1000, label: "1 day" },
    ];
  }

  const code = subscription.planSnapshot?.code;

  if (code === "day_pass") {
    return [
      { key: "2h", milliseconds: 2 * 60 * 60 * 1000, label: "2 hours" },
      { key: "30m", milliseconds: 30 * 60 * 1000, label: "30 minutes" },
    ];
  }

  return [
    { key: "7d", milliseconds: 7 * 24 * 60 * 60 * 1000, label: "7 days" },
    { key: "3d", milliseconds: 3 * 24 * 60 * 60 * 1000, label: "3 days" },
    { key: "1d", milliseconds: 24 * 60 * 60 * 1000, label: "1 day" },
  ];
}

/**
 * Creates at most one due reminder for each threshold and one expiry notice.
 * @param {object} subscription - Current FamilySubscription document.
 * @param {Date|string|number} [nowValue=new Date()] - Reminder evaluation time.
 * @returns {Promise<object|null>} Nearest active reminder or expiry notification.
 * @sideEffects Upserts deduplicated Notification documents in MongoDB.
 */
export async function synchronizeSubscriptionReminders(
  subscription,
  nowValue = new Date(),
) {
  if (!subscription.currentPeriodEndsAt) {
    return null;
  }

  const now = new Date(nowValue);
  const expiry = new Date(subscription.currentPeriodEndsAt);
  const remaining = expiry.getTime() - now.getTime();
  const periodKey = expiry.toISOString();

  if (remaining <= 0) {
    return Notification.findOneAndUpdate(
      {
        deduplicationKey:
          "subscription:" + subscription.family + ":" + periodKey + ":expired",
      },
      {
        $setOnInsert: {
          recipient: subscription.family,
          type: "subscription_expired",
          title: "Subscription expired",
          message:
            "Premium access has ended. Existing care history and bookings remain available.",
          actionUrl: "/subscription",
          metadata: { periodEndsAt: expiry },
        },
      },
      { upsert: true, new: true },
    );
  }

  const thresholds = getReminderThresholds(subscription);
  let nearest = null;

  for (const threshold of thresholds) {
    if (remaining <= threshold.milliseconds) {
      const type =
        subscription.status === "trialing"
          ? "trial_expiring"
          : "subscription_expiring";
      nearest = await Notification.findOneAndUpdate(
        {
          deduplicationKey:
            "subscription:" +
            subscription.family +
            ":" +
            periodKey +
            ":" +
            threshold.key,
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
            metadata: {
              threshold: threshold.key,
              periodEndsAt: expiry,
            },
          },
        },
        { upsert: true, new: true },
      );
    }
  }

  return nearest;
}
