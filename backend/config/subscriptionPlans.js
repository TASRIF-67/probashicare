import { PREMIUM_ENTITLEMENTS } from "../utils/subscriptionConstants.js";

/**
 * Backend-authoritative development plan definitions.
 *
 * The frontend may select only a plan code. Price, currency, duration, access
 * level, and entitlement values always come from this trusted configuration.
 * These BDT prices are test values rather than production commercial pricing.
 */
export const SUBSCRIPTION_PLAN_DEFINITIONS = [
  {
    code: "day_pass",
    name: "Day Pass",
    description: "Twenty-four hours of Premium family access.",
    accessLevel: "premium",
    durationType: "hours",
    durationValue: 24,
    price: 199,
    currency: "BDT",
    // Array spread creates a new features array for this plan.
    features: [...PREMIUM_ENTITLEMENTS],
    isActive: true,
  },
  {
    code: "monthly",
    name: "Monthly",
    description: "One calendar month of Premium family access.",
    accessLevel: "premium",
    durationType: "months",
    durationValue: 1,
    price: 1499,
    currency: "BDT",
    features: [...PREMIUM_ENTITLEMENTS],
    isActive: true,
  },
  {
    code: "yearly",
    name: "Yearly",
    description:
      "One calendar year of Premium access at a prototype discounted price.",
    accessLevel: "premium",
    durationType: "years",
    durationValue: 1,
    price: 14999,
    currency: "BDT",
    features: [...PREMIUM_ENTITLEMENTS],
    isActive: true,
  },
];

/*
 * After changing a definition, run:
 * npm.cmd run db:sync-subscription-plans --prefix backend
 *
 * Existing FamilySubscription and SubscriptionPayment snapshots remain
 * unchanged, which preserves historical prices and entitlements.
 */
