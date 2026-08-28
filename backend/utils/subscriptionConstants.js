/*
 * Central subscription values are exported from one file so schemas,
 * validators, services, middleware, and tests use exactly the same strings.
 */

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
  "stripe_checkout",
];

export const PAYMENT_PROVIDERS = ["prototype", "stripe"];

export const DURATION_TYPES = ["hours", "months", "years"];

// Entitlement codes describe capabilities, not plan names. Routes therefore
// ask for a capability and remain independent from monthly/yearly pricing.
export const ENTITLEMENTS = {
  CAREGIVER_BOOKING: "caregiver_booking",
  SCHEDULED_BOOKING: "scheduled_booking",
  LONG_TERM_BOOKING: "long_term_booking",
  WELLNESS_EARLY_ALERTS: "wellness_early_alerts",
  WELLNESS_AI_SUMMARY: "wellness_ai_summary",
  ADVANCED_VITALS: "advanced_vitals",
};

// `Object.values` returns an array containing every value in ENTITLEMENTS.
export const PREMIUM_ENTITLEMENTS = Object.values(ENTITLEMENTS);

export const SUBSCRIPTION_PLAN_CODES = ["day_pass", "monthly", "yearly"];

/*
 * To add a Premium capability:
 * 1. add its code to ENTITLEMENTS,
 * 2. include it in the relevant plan definitions,
 * 3. protect the backend route with requireFamilyEntitlement.
 */
