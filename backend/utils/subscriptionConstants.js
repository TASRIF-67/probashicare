export const ACCESS_LEVELS = ["core", "premium"];
export const SUBSCRIPTION_STATUSES = [
  "none",
  "trialing",
  "active",
  "expired",
  "cancelled",
];
export const PAYMENT_STATUSES = [
  "pending",
  "completed",
  "failed",
  "cancelled",
  "refunded",
];
export const PAYMENT_METHODS = [
  "test_card",
  "test_mobile_banking",
  "test_wallet",
];
export const DURATION_TYPES = ["hours", "months", "years"];
export const ENTITLEMENTS = {
  CAREGIVER_BOOKING: "caregiver_booking",
  SCHEDULED_BOOKING: "scheduled_booking",
  LONG_TERM_BOOKING: "long_term_booking",
  WELLNESS_EARLY_ALERTS: "wellness_early_alerts",
  WELLNESS_AI_SUMMARY: "wellness_ai_summary",
  ADVANCED_VITALS: "advanced_vitals",
};
export const PREMIUM_ENTITLEMENTS = Object.values(ENTITLEMENTS);
export const SUBSCRIPTION_PLAN_CODES = ["day_pass", "monthly", "yearly"];

/*
 * Add a Premium entitlement here, include it in a plan definition, and protect
 * new endpoints through the shared entitlement middleware rather than a plan check.
 */
