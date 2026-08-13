import { PREMIUM_ENTITLEMENTS } from "../utils/subscriptionConstants.js";

/**
 * Development-only plan prices controlled by the backend.
 * These BDT amounts are prototype values and are not production pricing.
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

/* Add a plan here, then run db:sync-subscription-plans. */
