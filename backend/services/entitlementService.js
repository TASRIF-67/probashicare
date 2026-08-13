import {
  ENTITLEMENTS,
  PREMIUM_ENTITLEMENTS,
} from "../utils/subscriptionConstants.js";

/**
 * Determines effective subscription access without writing to MongoDB.
 * @param {object|null} subscription - Stored FamilySubscription-like value.
 * @param {Date|string|number} [nowValue=new Date()] - Time used for the decision.
 * @returns {{accessLevel: "core"|"premium", status: string, isPremium: boolean, entitlements: string[], expiresAt: Date|null}} Effective access result.
 * @sideEffects None.
 */
export function determineSubscriptionAccess(
  subscription,
  nowValue = new Date(),
) {
  const now = new Date(nowValue);

  if (Number.isNaN(now.getTime())) {
    throw new TypeError("A valid access-check time is required.");
  }

  if (!subscription) {
    return {
      accessLevel: "core",
      status: "none",
      isPremium: false,
      entitlements: [],
      expiresAt: null,
    };
  }

  const allowedStatuses = ["trialing", "active"];
  const hasEligibleStatus = allowedStatuses.includes(subscription.status);
  let expiresAt = null;

  if (subscription.currentPeriodEndsAt) {
    expiresAt = new Date(subscription.currentPeriodEndsAt);
  }

  const hasValidExpiry =
    expiresAt !== null &&
    !Number.isNaN(expiresAt.getTime()) &&
    expiresAt.getTime() > now.getTime();
  const isPremium =
    subscription.accessLevel === "premium" &&
    hasEligibleStatus &&
    hasValidExpiry;

  if (!isPremium) {
    let effectiveStatus = subscription.status || "none";

    if (hasEligibleStatus && !hasValidExpiry) {
      effectiveStatus = "expired";
    }

    return {
      accessLevel: "core",
      status: effectiveStatus,
      isPremium: false,
      entitlements: [],
      expiresAt,
    };
  }

  let entitlements = [...PREMIUM_ENTITLEMENTS];

  if (
    subscription.status === "active" &&
    subscription.planSnapshot &&
    Array.isArray(subscription.planSnapshot.features)
  ) {
    entitlements = [...subscription.planSnapshot.features];
  }

  return {
    accessLevel: "premium",
    status: subscription.status,
    isPremium: true,
    entitlements,
    expiresAt,
  };
}

/**
 * Checks whether an effective access result contains one entitlement.
 * @param {{entitlements?: string[]}|null} access - Result from determineSubscriptionAccess.
 * @param {string} entitlement - Required reusable entitlement code.
 * @returns {boolean} True only when the entitlement is known and granted.
 * @sideEffects None.
 */
export function hasEntitlement(access, entitlement) {
  const knownEntitlements = Object.values(ENTITLEMENTS);

  if (!knownEntitlements.includes(entitlement)) {
    return false;
  }

  if (!access || !Array.isArray(access.entitlements)) {
    return false;
  }

  return access.entitlements.includes(entitlement);
}

/*
 * Add future Premium features to ENTITLEMENTS and plan features. Backend routes
 * can then use requireFamilyEntitlement(code) without knowing a plan name.
 */
