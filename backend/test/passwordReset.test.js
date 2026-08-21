import assert from "node:assert/strict";
import test from "node:test";
import {
  createPasswordResetToken,
  hashPasswordResetToken,
} from "../utils/authTokens.js";
import {
  validateForgotPassword,
  validatePasswordReset,
} from "../middleware/validateAuth.js";

/**
 * Runs one Express-style validation middleware and returns its next argument.
 * @param {Function} middleware - Validation middleware under test.
 * @param {object} body - Simulated request body.
 * @returns {{request: object, nextValue: unknown}} Mutated request and forwarded value.
 * @sideEffects Executes the supplied middleware against an in-memory request.
 */
function runValidation(middleware, body) {
  const request = {
    body,
  };
  let nextValue;

  middleware(request, {}, function captureNext(value) {
    nextValue = value;
  });

  return {
    request,
    nextValue,
  };
}

test("password reset tokens store only a reproducible hash", function verifyTokenHashing() {
  const token = createPasswordResetToken();

  assert.notEqual(token.rawToken, token.tokenHash);
  assert.equal(hashPasswordResetToken(token.rawToken), token.tokenHash);
  assert.equal(token.tokenHash.length, 64);
});

test("forgot password validation normalizes email", function verifyEmailNormalization() {
  const result = runValidation(validateForgotPassword, {
    email: "  Family@Example.com  ",
  });

  assert.equal(result.nextValue, undefined);
  assert.equal(result.request.body.email, "family@example.com");
});

test("password reset validation rejects mismatched passwords", function rejectMismatch() {
  const result = runValidation(validatePasswordReset, {
    token: "valid-looking-token",
    password: "new-password",
    confirmPassword: "different-password",
  });

  assert.equal(result.nextValue.statusCode, 422);
  assert.equal(
    result.nextValue.details.confirmPassword,
    "Passwords must match.",
  );
});
