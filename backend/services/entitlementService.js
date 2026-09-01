import {
  ENTITLEMENTS,
  PREMIUM_ENTITLEMENTS,
} from "../utils/subscriptionConstants.js";

/**
 * Builds the normal Core access response.
 * @param {string} status - Effective stored/access status.
 * @param {Date|null} expiresAt - Parsed expiry when one exists.
 * @returns {{
 *   accessLevel: "core",
 *   status: string,
 *   isPremium: false,
 *   entitlements: [],
 *   expiresAt: Date|null
 * }} Effective Core access.
 * @sideEffects None.
 */
function createCoreAccess(status, expiresAt) {
  return {
    accessLevel: "core",
    status,
    isPremium: false,
    entitlements: [],
    expiresAt,
  };
}

/**
 * Determines effective subscription access without writing to MongoDB.
 * @param {object|null} subscription - Stored FamilySubscription-like value.
 * @param {Date|string|number} [nowValue=new Date()] - Time used for the decision.
 * @returns {{
 *   accessLevel: "core"|"premium",
 *   status: string,
 *   isPremium: boolean,
 *   entitlements: string[],
 *   expiresAt: Date|null
 * }} Effective access result.
 * @sideEffects None.
 */
export function determineSubscriptionAccess(
  subscription,
  nowValue = new Date(),
) {
  // Execution sequence:
  // 1. Normalize the comparison time and reject invalid dates.
  // 2. Return Core access for missing, cancelled, or expired records.
  // 3. Return the stored Premium snapshot only for effective paid/trial access.
  const now = new Date(nowValue);

  if (Number.isNaN(now.getTime())) {
    throw new TypeError("A valid access-check time is required.");
  }

  if (!subscription) {
    return createCoreAccess("none", null);
  }

  const premiumStatuses = ["trialing", "active"];

  // `includes` returns true only when the exact stored status is allowed.
  const hasEligibleStatus = premiumStatuses.includes(subscription.status);

  let expiresAt = null;

  if (subscription.currentPeriodEndsAt) {
    expiresAt = new Date(subscription.currentPeriodEndsAt);
  }

  const expiryIsValid =
    expiresAt !== null && !Number.isNaN(expiresAt.getTime());
  const expiryIsInFuture = expiryIsValid && expiresAt.getTime() > now.getTime();

  const isPremium =
    subscription.accessLevel === "premium" &&
    hasEligibleStatus &&
    expiryIsInFuture;

  if (!isPremium) {
    let effectiveStatus = subscription.status || "none";

    if (hasEligibleStatus && !expiryIsInFuture) {
      // A stored active/trialing status cannot grant access after its expiry.
      effectiveStatus = "expired";
    }

    return createCoreAccess(effectiveStatus, expiresAt);
  }

  // Trials receive the current complete Premium entitlement list.
  let entitlements = [...PREMIUM_ENTITLEMENTS];

  const paidPlanHasFeatureSnapshot =
    subscription.status === "active" &&
    subscription.planSnapshot &&
    Array.isArray(subscription.planSnapshot.features);

  if (paidPlanHasFeatureSnapshot) {
    // Paid access uses its historical snapshot, not today's catalog.
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
 * Checks whether an effective access result contains one known entitlement.
 * @param {{entitlements?: string[]}|null} access - Result from determineSubscriptionAccess.
 * @param {string} entitlement - Required reusable entitlement code.
 * @returns {boolean} True only when the entitlement is known and granted.
 * @sideEffects None.
 */
export function hasEntitlement(access, entitlement) {
  // `Object.values` creates an array of the configured entitlement codes.
  const knownEntitlements = Object.values(ENTITLEMENTS);

  if (!knownEntitlements.includes(entitlement)) {
    return false;
  }

  if (!access || !Array.isArray(access.entitlements)) {
    return false;
  }

  return access.entitlements.includes(entitlement);
}
