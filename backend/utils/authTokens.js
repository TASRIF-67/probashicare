import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

/**
 * Creates a random raw token and a database-safe SHA-256 hash.
 * @param {number} bytes - Number of cryptographically random bytes.
 * @returns {{rawToken: string, tokenHash: string}} Email token and stored hash.
 * @sideEffects Reads the operating system cryptographic random source.
 */
function createRandomHashedToken(bytes) {
  // `randomBytes` returns unpredictable binary bytes. `toString("hex")`
  // converts them into URL-safe hexadecimal text.
  const rawToken = crypto
    .randomBytes(bytes)
    .toString("hex");

  // Only this deterministic hash is stored. Someone reading the database
  // cannot directly use it as the emailed raw token.
  const tokenHash = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  return {
    rawToken,
    tokenHash,
  };
}

/**
 * Hashes one raw one-time token for a database equality lookup.
 * @param {string} rawToken - Token from an emailed URL.
 * @returns {string} SHA-256 hexadecimal digest.
 * @sideEffects None.
 */
function hashOneTimeToken(rawToken) {
  return crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");
}

/**
 * Signs a session JWT for an authenticated user.
 * @param {{_id: import("mongoose").Types.ObjectId, role: string}} user - User.
 * @returns {string} Signed JWT containing sub and role claims.
 * @sideEffects None.
 */
export function createSessionToken(user) {
  const payload = {
    sub: user._id.toString(),
    role: user.role,
  };
  const options = {
    expiresIn: env.jwtExpiresIn,
  };

  return jwt.sign(
    payload,
    env.jwtSecret,
    options,
  );
}

/**
 * Verifies a session token and returns its trusted claims.
 * @param {string} token - Signed JWT from the HTTP-only cookie.
 * @returns {{sub: string, role: string, iat: number, exp: number}} Claims.
 * @sideEffects Throws when the token is invalid or expired.
 */
export function verifySessionToken(token) {
  return jwt.verify(
    token,
    env.jwtSecret,
  );
}

/**
 * Creates a high-entropy email-verification token and storage hash.
 * @param {number} [bytes=32] - Number of random bytes.
 * @returns {{rawToken: string, tokenHash: string}} Raw and hashed token.
 * @sideEffects Reads the operating system cryptographic random source.
 */
export function createVerificationToken(bytes = 32) {
  return createRandomHashedToken(bytes);
}

/**
 * Hashes a received verification token for MongoDB lookup.
 * @param {string} rawToken - Token received from the verification link.
 * @returns {string} SHA-256 hexadecimal digest.
 * @sideEffects None.
 */
export function hashVerificationToken(rawToken) {
  return hashOneTimeToken(rawToken);
}

/**
 * Creates a high-entropy password-reset token and storage hash.
 * @param {number} [bytes=32] - Number of random bytes.
 * @returns {{rawToken: string, tokenHash: string}} Raw and hashed token.
 * @sideEffects Reads the operating system cryptographic random source.
 */
export function createPasswordResetToken(bytes = 32) {
  return createRandomHashedToken(bytes);
}

/**
 * Hashes a browser-provided password-reset token for lookup.
 * @param {string} rawToken - Token from the reset URL.
 * @returns {string} SHA-256 hexadecimal digest.
 * @sideEffects None.
 */
export function hashPasswordResetToken(rawToken) {
  return hashOneTimeToken(rawToken);
}
