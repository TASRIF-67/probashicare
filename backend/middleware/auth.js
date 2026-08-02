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
    const token = request.cookies?.session;
    if (!token) throw new ApiError(401, "Authentication required.");

    const claims = verifySessionToken(token);
    const user = await User.findById(claims.sub);
    if (!user) throw new ApiError(401, "The account for this session no longer exists.");

    request.user = user;
    next();
  } catch (error) {
    if (error instanceof ApiError) return next(error);
    return next(new ApiError(401, "Your session is invalid or has expired."));
  }
}

/**
 * Restricts an authenticated route to one or more roles.
 * @param {...string} allowedRoles - Roles permitted to continue.
 * @returns {import("express").RequestHandler} Role-checking Express middleware.
 * @sideEffects May end request processing by forwarding a 403 error.
 */
export function allowRoles(...allowedRoles) {
  return function checkRole(request, _response, next) {
    if (!request.user) return next(new ApiError(401, "Authentication required."));
    if (!allowedRoles.includes(request.user.role)) {
      return next(new ApiError(403, "You do not have permission to perform this action."));
    }
    return next();
  };
}
