import { ApiError } from "../utils/ApiError.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates family email/password signup input before database work.
 * @param {import("express").Request} request - Request with `name`, `email`, and `password`.
 * @param {import("express").Response} _response - Express response, unused.
 * @param {import("express").NextFunction} next - Middleware continuation.
 * @returns {void}
 * @sideEffects Normalizes name and email on `request.body`, or forwards a 422 error.
 */
export function validateSignup(request, _response, next) {
  const name = request.body?.name?.trim();
  const email = request.body?.email?.trim().toLowerCase();
  const password = request.body?.password;
  const details = {};

  if (!name || name.length > 100) details.name = "Name must be between 1 and 100 characters.";
  if (!email || !EMAIL_PATTERN.test(email)) details.email = "Enter a valid email address.";
  if (typeof password !== "string" || password.length < 8) {
    details.password = "Password must contain at least 8 characters.";
  }

  if (Object.keys(details).length) {
    return next(new ApiError(422, "Please correct the highlighted fields.", details));
  }
  request.body = { ...request.body, name, email };
  return next();
}

/**
 * Validates email/password login input.
 * @param {import("express").Request} request - Request with `email` and `password`.
 * @param {import("express").Response} _response - Express response, unused.
 * @param {import("express").NextFunction} next - Middleware continuation.
 * @returns {void}
 * @sideEffects Normalizes email on `request.body`, or forwards a 422 error.
 */
export function validateLogin(request, _response, next) {
  const email = request.body?.email?.trim().toLowerCase();
  const password = request.body?.password;
  if (!email || !EMAIL_PATTERN.test(email) || typeof password !== "string" || !password) {
    return next(new ApiError(422, "A valid email and password are required."));
  }
  request.body = { ...request.body, email };
  return next();
}
