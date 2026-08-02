import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

const googleClient = new OAuth2Client(env.googleClientId);

/**
 * Verifies a Google credential and extracts identity fields used by ProbashiCare.
 * @param {string} credential - Google Identity Services ID token.
 * @returns {Promise<{googleId: string, email: string, name: string, emailVerified: boolean}>} Verified Google identity.
 * @sideEffects Calls Google's token verification infrastructure through the auth library.
 */
export async function verifyGoogleCredential(credential) {
  if (!env.googleClientId) {
    throw new ApiError(503, "Google sign-in is not configured.");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: env.googleClientId,
  });
  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email || !payload.name) {
    throw new ApiError(401, "Google did not return a complete identity.");
  }

  return {
    googleId: payload.sub,
    email: payload.email.toLowerCase(),
    name: payload.name,
    emailVerified: Boolean(payload.email_verified),
  };
}
