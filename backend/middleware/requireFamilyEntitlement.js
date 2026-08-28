import { ApiError } from "../utils/ApiError.js";
import { ENTITLEMENTS } from "../utils/subscriptionConstants.js";
import { hasEntitlement } from "../services/entitlementService.js";
import { getFamilySubscriptionAccess } from "../services/subscriptionService.js";

/**
 * Creates middleware that requires one Premium entitlement for a Family user.
 * @param {string} entitlement - One code from ENTITLEMENTS.
 * @returns {import("express").RequestHandler} Async entitlement middleware.
 * @sideEffects Reads/synchronizes subscription state and may attach request.subscriptionAccess.
 * @throws {TypeError} Immediately rejects an unknown code during route setup.
 */
export function requireFamilyEntitlement(entitlement) {
  // Validate at application startup rather than discovering a misspelled
  // entitlement only when a user reaches the route.
  const knownEntitlements = Object.values(ENTITLEMENTS);

  if (!knownEntitlements.includes(entitlement)) {
    throw new TypeError("A known Family entitlement is required.");
  }

  /**
   * Checks authentication, Family role, current access, and entitlement.
   * @param {import("express").Request} request - Authenticated request.
   * @param {import("express").Response} _response - Unused response.
   * @param {import("express").NextFunction} next - Express continuation.
   * @returns {Promise<void>} Resolves after allowing or forwarding an error.
   * @sideEffects May persist expiry and attaches effective access when allowed.
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

      if (!hasEntitlement(result.access, entitlement)) {
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

      request.subscriptionAccess = result.access;
      next();
    } catch (error) {
      next(error);
    }
  };
}
