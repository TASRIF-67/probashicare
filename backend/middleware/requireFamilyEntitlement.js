import { ApiError } from "../utils/ApiError.js";
import { ENTITLEMENTS } from "../utils/subscriptionConstants.js";
import {
  determineSubscriptionAccess,
  hasEntitlement,
} from "../services/entitlementService.js";
import { getFamilySubscriptionAccess } from "../services/subscriptionService.js";

/**
 * Creates middleware that requires one Premium entitlement for a Family user.
 * @param {string} entitlement - One code from ENTITLEMENTS.
 * @returns {import("express").RequestHandler} Async entitlement middleware.
 * @sideEffects Reads subscription data, may synchronize expiry, and attaches request.subscriptionAccess.
 * @throws {TypeError} Immediately rejects an unknown entitlement during route setup.
 */
export function requireFamilyEntitlement(entitlement) {
  const knownEntitlements = Object.values(ENTITLEMENTS);

  if (!knownEntitlements.includes(entitlement)) {
    throw new TypeError("A known Family entitlement is required.");
  }

  /**
   * Checks authentication, Family role, current access, and requested entitlement.
   * @param {import("express").Request} request - Authenticated Express request.
   * @param {import("express").Response} _response - Unused response object.
   * @param {import("express").NextFunction} next - Express continuation.
   * @returns {Promise<void>} Resolves after allowing or forwarding an error.
   * @sideEffects May read/write subscription expiry state and attach access details.
   */
  return async function checkFamilyEntitlement(request, _response, next) {
    if (!request.user) {
      next(new ApiError(401, "Authentication required."));
      return;
    }

    if (request.user.role !== "family") {
      next(
        new ApiError(
          403,
          "Only family accounts can use Family Premium features.",
        ),
      );
      return;
    }

    try {
      const result = await getFamilySubscriptionAccess(request.user._id);
      const access = determineSubscriptionAccess(result.subscription);

      if (!hasEntitlement(access, entitlement)) {
        next(
          new ApiError(
            403,
            "An active trial or Premium subscription is required for this feature.",
            {
              code: "PREMIUM_REQUIRED",
              entitlement,
            },
          ),
        );
        return;
      }

      request.subscriptionAccess = access;
      next();
    } catch (error) {
      next(error);
    }
  };
}

/*
 * Protect a new Premium endpoint by placing this middleware after requireAuth
 * and before the controller. Existing historical/core routes should not use it.
 */
