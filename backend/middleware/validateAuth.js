import { ApiError } from "../utils/ApiError.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalizes a possible email value for comparison and storage.
 * @param {unknown} value - Untrusted request value.
 * @returns {string} Trimmed lowercase email text or an empty string.
 * @sideEffects None.
 */
function normalizeEmail(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase();
}

/**
 * Checks whether a validation-details object contains any field errors.
 * @param {Record<string, string>} details - Collected field messages.
 * @returns {boolean} True when at least one error exists.
 * @sideEffects None.
 */
function hasValidationErrors(details) {
  // `Object.keys` returns an array containing the object's own field names.
  return Object.keys(details).length > 0;
}

/**
 * Validates Family email/password signup input before database work.
 * @param {import("express").Request} request - Signup request.
 * @param {import("express").Response} _response - Unused response.
 * @param {import("express").NextFunction} next - Express continuation.
 * @returns {void}
 * @sideEffects Normalizes request.body or forwards a 422 error.
 */
export function validateSignup(request, _response, next) {
  const name = String(request.body?.name || "").trim();
  const email = normalizeEmail(request.body?.email);
  const password = request.body?.password;
  const details = {};

  if (!name || name.length > 100) {
    details.name = "Name must be between 1 and 100 characters.";
  }

  if (!email || !EMAIL_PATTERN.test(email)) {
    details.email = "Enter a valid email address.";
  }

  if (
    typeof password !== "string" ||
    password.length < 8
  ) {
    details.password =
      "Password must contain at least 8 characters.";
  }

  if (hasValidationErrors(details)) {
    next(
      new ApiError(
        422,
        "Please correct the highlighted fields.",
        details,
      ),
    );
    return;
  }

  // The spread operator copies existing signup fields before normalized values
  // replace name and email.
  request.body = {
    ...request.body,
    name,
    email,
  };
  next();
}

/**
 * Validates email/password login input.
 * @param {import("express").Request} request - Login request.
 * @param {import("express").Response} _response - Unused response.
 * @param {import("express").NextFunction} next - Express continuation.
 * @returns {void}
 * @sideEffects Normalizes request.body email or forwards a 422 error.
 */
export function validateLogin(request, _response, next) {
  const email = normalizeEmail(request.body?.email);
  const password = request.body?.password;
  const passwordIsMissing =
    typeof password !== "string" || !password;

  if (
    !email ||
    !EMAIL_PATTERN.test(email) ||
    passwordIsMissing
  ) {
    next(
      new ApiError(
        422,
        "A valid email and password are required.",
      ),
    );
    return;
  }

  request.body = {
    ...request.body,
    email,
  };
  next();
}

/**
 * Validates and normalizes a password-reset request email.
 * @param {import("express").Request} request - Forgot-password request.
 * @param {import("express").Response} _response - Unused response.
 * @param {import("express").NextFunction} next - Express continuation.
 * @returns {void}
 * @sideEffects Normalizes email or forwards a 422 error.
 */
export function validateForgotPassword(request, _response, next) {
  const email = normalizeEmail(request.body?.email);

  if (!email || !EMAIL_PATTERN.test(email)) {
    next(
      new ApiError(
        422,
        "Enter a valid email address.",
      ),
    );
    return;
  }

  request.body = {
    ...request.body,
    email,
  };
  next();
}

/**
 * Validates the one-time reset token and matching new passwords.
 * @param {import("express").Request} request - Reset request.
 * @param {import("express").Response} _response - Unused response.
 * @param {import("express").NextFunction} next - Express continuation.
 * @returns {void}
 * @sideEffects Normalizes request.body or forwards a 422 error.
 */
export function validatePasswordReset(request, _response, next) {
  const token = request.body?.token;
  const password = request.body?.password;
  const confirmPassword = request.body?.confirmPassword;
  const details = {};

  if (
    typeof token !== "string" ||
    !token.trim()
  ) {
    details.token = "Password-reset token is required.";
  }

  if (
    typeof password !== "string" ||
    password.length < 8
  ) {
    details.password =
      "Password must contain at least 8 characters.";
  }

  if (confirmPassword !== password) {
    details.confirmPassword = "Passwords must match.";
  }

  if (hasValidationErrors(details)) {
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
 * Validates editable Family owner identity fields.
 * @param {import("express").Request} request - Account update request.
 * @param {import("express").Response} _response - Unused response.
 * @param {import("express").NextFunction} next - Express continuation.
 * @returns {void}
 * @sideEffects Normalizes request.body or forwards a 422 error.
 */
export function validateFamilyAccountUpdate(
  request,
  _response,
  next,
) {
  const name = String(request.body?.name || "").trim();
  const email = normalizeEmail(request.body?.email);
  const currentPassword = request.body?.currentPassword;
  const details = {};

  if (!name || name.length > 100) {
    details.name =
      "Name must be between 1 and 100 characters.";
  }

  if (!email || !EMAIL_PATTERN.test(email)) {
    details.email = "Enter a valid email address.";
  }

  if (
    currentPassword !== undefined &&
    typeof currentPassword !== "string"
  ) {
    details.currentPassword =
      "Current password must be text.";
  }

  if (hasValidationErrors(details)) {
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
