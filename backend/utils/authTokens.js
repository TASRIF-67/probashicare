import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

/**
 * Signs a session JWT for an authenticated user.
 * @param {{_id: import("mongoose").Types.ObjectId, role: string}} user - User identity and role.
 * @returns {string} Signed JWT containing `{ sub, role }`.
 * @sideEffects None.
 */
export function createSessionToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

/**
 * Verifies a session token and returns its claims.
 * @param {string} token - Signed JWT.
 * @returns {{sub: string, role: string, iat: number, exp: number}} Verified token claims.
 * @sideEffects Throws when the token is invalid or expired.
 */
export function verifySessionToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

/**
 * Creates a high-entropy email verification token and its database-safe hash.
 * @param {number} [bytes=32] - Number of cryptographically random bytes.
 * @returns {{rawToken: string, tokenHash: string}} Raw token for email and SHA-256 hash for storage.
 * @sideEffects Reads from the operating system cryptographic random source.
 */
export function createVerificationToken(bytes = 32) {
  const rawToken = crypto.randomBytes(bytes).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  return { rawToken, tokenHash };
}

/**
 * Hashes a received verification token for lookup.
 * @param {string} rawToken - Token received from the verification link.
 * @returns {string} SHA-256 hexadecimal digest.
 * @sideEffects None.
 */
export function hashVerificationToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Creates a high-entropy password-reset token and a safe hash for MongoDB.
 * @param {number} [bytes=32] - Number of cryptographically random bytes.
 * @returns {{rawToken: string, tokenHash: string}} Raw email token and SHA-256 storage hash.
 * @sideEffects Reads from the operating system cryptographic random source.
 */
export function createPasswordResetToken(bytes = 32) {
  return createVerificationToken(bytes);
}

/**
 * Hashes a password-reset token received from the browser for database lookup.
 * @param {string} rawToken - Raw token from the password-reset URL.
 * @returns {string} SHA-256 hexadecimal digest.
 * @sideEffects None.
 */
export function hashPasswordResetToken(rawToken) {
  return hashVerificationToken(rawToken);
}
