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

/**
 * Validates and normalizes the email used to request a password-reset link.
 * @param {import("express").Request} request - Request containing an email address.
 * @param {import("express").Response} _response - Express response, unused.
 * @param {import("express").NextFunction} next - Middleware continuation.
 * @returns {void}
 * @sideEffects Normalizes request body email or forwards a 422 validation error.
 */
export function validateForgotPassword(request, _response, next) {
  const email = request.body?.email?.trim().toLowerCase();

  if (!email || !EMAIL_PATTERN.test(email)) {
    next(new ApiError(422, "Enter a valid email address."));
    return;
  }

  request.body = {
    ...request.body,
    email,
  };
  next();
}

/**
 * Validates the one-time token and matching new passwords before reset work.
 * @param {import("express").Request} request - Request containing token and password fields.
 * @param {import("express").Response} _response - Express response, unused.
 * @param {import("express").NextFunction} next - Middleware continuation.
 * @returns {void}
 * @sideEffects Forwards a 422 validation error when reset input is unsafe.
 */
export function validatePasswordReset(request, _response, next) {
  const token = request.body?.token;
  const password = request.body?.password;
  const confirmPassword = request.body?.confirmPassword;
  const details = {};

  if (typeof token !== "string" || !token.trim()) {
    details.token = "Password-reset token is required.";
  }

  if (typeof password !== "string" || password.length < 8) {
    details.password = "Password must contain at least 8 characters.";
  }

  if (confirmPassword !== password) {
    details.confirmPassword = "Passwords must match.";
  }

  if (Object.keys(details).length > 0) {
    next(
      new ApiError(
        422,
        "Please correct the highlighted fields.",
        details,
      ),
    );
    return;
  }

  request.body = {
    token: token.trim(),
    password,
    confirmPassword,
  };
  next();
}

/**
 * Validates editable family account fields before the account controller runs.
 * @param {import("express").Request} request - Request with `name`, `email`, and optional `currentPassword`.
 * @param {import("express").Response} _response - Express response, unused.
 * @param {import("express").NextFunction} next - Middleware continuation.
 * @returns {void}
 * @sideEffects Normalizes the submitted name and email or forwards a 422 error.
 */
export function validateFamilyAccountUpdate(request, _response, next) {
  const name = request.body?.name?.trim();
  const email = request.body?.email?.trim().toLowerCase();
  const currentPassword = request.body?.currentPassword;
  const details = {};

  if (!name || name.length > 100) {
    details.name = "Name must be between 1 and 100 characters.";
  }

  if (!email || !EMAIL_PATTERN.test(email)) {
    details.email = "Enter a valid email address.";
  }

  if (
    currentPassword !== undefined &&
    typeof currentPassword !== "string"
  ) {
    details.currentPassword = "Current password must be text.";
  }

  if (Object.keys(details).length > 0) {
    next(
      new ApiError(
        422,
        "Please correct the highlighted fields.",
        details,
      ),
    );
    return;
  }

  request.body = {
    ...request.body,
    name,
    email,
    currentPassword: currentPassword || "",
  };
  next();
}
