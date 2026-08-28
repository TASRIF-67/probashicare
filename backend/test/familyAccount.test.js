import assert from "node:assert/strict";
import test from "node:test";
import { validateFamilyAccountUpdate } from "../middleware/validateAuth.js";
import {
  createVerificationToken,
  hashVerificationToken,
} from "../utils/authTokens.js";
import { toPublicUser } from "../utils/userResponse.js";

/**
 * Runs one Express-style middleware with an in-memory request.
 * @param {Function} middleware - Validation middleware under test.
 * @param {object} body - Simulated JSON request body.
 * @returns {{request: object, nextValue: unknown}} Mutated request and next value.
 * @sideEffects Executes middleware without an HTTP server.
 */
function runValidation(middleware, body) {
  const request = {
    body,
  };
  let nextValue;

  /**
   * Records the value forwarded by Express middleware.
   * @param {unknown} value - Error or undefined passed to next.
   * @returns {void}
   * @sideEffects Assigns the outer nextValue variable.
   */
  function captureNext(value) {
    nextValue = value;
  }

  middleware(request, {}, captureNext);

  return {
    request,
    nextValue,
  };
}

/**
 * Proves a raw verification token is not stored and its hash is reproducible.
 * @param {void} _unused - This test accepts no arguments.
 * @returns {void}
 * @sideEffects Reads cryptographic randomness and performs assertions.
 */
function verifyEmailTokenHashing() {
  const token = createVerificationToken();

  assert.notEqual(token.rawToken, token.tokenHash);
  assert.equal(
    hashVerificationToken(token.rawToken),
    token.tokenHash,
  );
  assert.equal(token.tokenHash.length, 64);
}

/**
 * Proves account validation trims name and normalizes email.
 * @param {void} _unused - This test accepts no arguments.
 * @returns {void}
 * @sideEffects Runs middleware and performs assertions.
 */
function verifyAccountNormalization() {
  const result = runValidation(
    validateFamilyAccountUpdate,
    {
      name: "  Family Owner  ",
      email: "  OWNER@Example.com  ",
      currentPassword: "current-password",
    },
  );

  assert.equal(result.nextValue, undefined);
  assert.deepEqual(result.request.body, {
    name: "Family Owner",
    email: "owner@example.com",
    currentPassword: "current-password",
  });
}

/**
 * Proves validation rejects a non-string current password.
 * @param {void} _unused - This test accepts no arguments.
 * @returns {void}
 * @sideEffects Runs middleware and performs assertions.
 */
function rejectNonTextPassword() {
  const result = runValidation(
    validateFamilyAccountUpdate,
    {
      name: "Family Owner",
      email: "owner@example.com",
      currentPassword: 12345678,
    },
  );

  assert.equal(result.nextValue.statusCode, 422);
  assert.equal(
    result.nextValue.details.currentPassword,
    "Current password must be text.",
  );
}

/**
 * Proves authentication responses contain only approved public fields.
 * @param {void} _unused - This test accepts no arguments.
 * @returns {void}
 * @sideEffects Performs in-memory assertions.
 */
function verifyPublicUserShape() {
  const privateUserDocument = {
    _id: {
      /**
       * Simulates Mongoose ObjectId conversion.
       * @param {void} _unused - This function accepts no arguments.
       * @returns {string} Stable test ID.
       * @sideEffects None.
       */
      toString() {
        return "family-user-id";
      },
    },
    name: "Family Owner",
    email: "owner@example.com",
    role: "family",
    isVerified: true,
    password: "private-password-hash",
    googleId: "private-google-id",
  };

  const publicUser = toPublicUser(
    privateUserDocument,
    true,
    null,
  );

  assert.deepEqual(publicUser, {
    id: "family-user-id",
    name: "Family Owner",
    email: "owner@example.com",
    role: "family",
    isVerified: true,
    hasLinkedElderlyProfiles: true,
    caregiverApplicationStatus: null,
  });

  // Object.hasOwn returns true only for a direct property on this object.
  assert.equal(
    Object.hasOwn(publicUser, "password"),
    false,
  );
  assert.equal(
    Object.hasOwn(publicUser, "googleId"),
    false,
  );
}

test(
  "email verification stores only a reproducible hash",
  verifyEmailTokenHashing,
);
test(
  "family account validation normalizes editable fields",
  verifyAccountNormalization,
);
test(
  "family account validation rejects a non-text password",
  rejectNonTextPassword,
);
test(
  "public user responses omit private authentication fields",
  verifyPublicUserShape,
);
