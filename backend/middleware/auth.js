import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { verifySessionToken } from "../utils/authTokens.js";

/**
 * Requires a valid session cookie and attaches the current User document.
 * @param {import("express").Request} request - Express request containing `cookies.session`.
 * @param {import("express").Response} _response - Express response, unused.
 * @param {import("express").NextFunction} next - Middleware continuation.
 * @returns {Promise<void>} Resolves after attaching `request.user` and advancing.
 * @sideEffects Reads the database and mutates `request.user`.
 */
export async function requireAuth(request, _response, next) {
  try {
    // The server stores the signed session token in an HTTP-only cookie.
    const token = request.cookies?.session;

    if (!token) {
      throw new ApiError(
        401,
        "Authentication required.",
      );
    }

    // Signature verification protects the user ID from client-side modification.
    const claims = verifySessionToken(token);

    // Load the current database record instead of trusting stale role data from the token.
    const user = await User.findById(claims.sub);

    if (!user) {
      throw new ApiError(
        401,
        "The account for this session no longer exists.",
      );
    }

    if (
      !user.isVerified &&
      (user.role === "family" || user.role === "caregiver")
    ) {
      throw new ApiError(
        401,
        "Verify your email address before continuing.",
      );
    }

    // Downstream role and controller middleware reads the authenticated user here.
    request.user = user;
    next();
  } catch (error) {
    // Preserve deliberate authentication errors such as a missing account.
    if (error instanceof ApiError) {
      next(error);
      return;
    }

    // Token parsing and signature failures receive one safe public message.
    next(
      new ApiError(
        401,
        "Your session is invalid or has expired.",
      ),
    );
  }
}

/**
 * Restricts an authenticated route to one or more roles.
 * @param {...string} allowedRoles - Roles permitted to continue.
 * @returns {import("express").RequestHandler} Role-checking Express middleware.
 * @sideEffects May end request processing by forwarding a 403 error.
 */

export function allowRoles(...allowedRoles) {
  /**
   * Checks the authenticated user's role against the roles captured by allowRoles.
   * @param {import("express").Request} request - Request expected to contain `request.user`.
   * @param {import("express").Response} _response - Express response, unused.
   * @param {import("express").NextFunction} next - Middleware continuation.
   * @returns {void}
   * @sideEffects Advances the middleware chain or forwards a 401/403 ApiError.
   */
  return function checkRole(request, _response, next) {
    // This guard also protects against accidentally mounting role checks before requireAuth.
    if (!request.user) {
      next(
        new ApiError(
          401,
          "Authentication required.",
        ),
      );
      return;
    }

    if (!allowedRoles.includes(request.user.role)) {
      next(
        new ApiError(
          403,
          "You do not have permission to perform this action.",
        ),
      );
      return;
    }

    next();
  };
}
