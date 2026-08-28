import { api } from "./api.js";

/**
 * Creates an unverified Family account.
 * @param {{name: string, email: string, password: string}} input - Form data.
 * @returns {Promise<{message: string, email: string}>} Verification details.
 * @sideEffects Creates an account/token and sends verification email.
 */
async function signup(input) {
  const response = await api.post(
    "/auth/signup",
    input,
  );
  return response.data.data;
}

/**
 * Creates an unverified Caregiver account and draft profile.
 * @param {{name: string, email: string, phone: string, password: string, confirmPassword: string}} input - Form data.
 * @returns {Promise<{message: string, email: string}>} Verification details.
 * @sideEffects Creates records and sends verification email.
 */
async function caregiverSignup(input) {
  const response = await api.post(
    "/auth/caregiver/signup",
    input,
  );
  return response.data.data;
}

/**
 * Starts an email/password session.
 * @param {{email: string, password: string}} input - Credentials.
 * @returns {Promise<{user: object}>} Public authenticated user.
 * @sideEffects Receives an HTTP-only session cookie.
 */
async function login(input) {
  const response = await api.post(
    "/auth/login",
    input,
  );
  return response.data.data;
}

/**
 * Starts or creates a Family session through Google.
 * @param {string} credential - Google ID token.
 * @returns {Promise<{user: object}>} Public authenticated user.
 * @sideEffects May create/link User and receives an HTTP-only cookie.
 */
async function loginWithGoogle(credential) {
  const requestBody = {
    credential,
  };
  const response = await api.post(
    "/auth/google",
    requestBody,
  );
  return response.data.data;
}

/**
 * Retrieves the current cookie-backed session.
 * @returns {Promise<{user: object}>} Current public user.
 * @sideEffects Sends one authenticated GET request.
 */
async function getCurrentUser() {
  const response = await api.get("/auth/me");
  return response.data.data;
}

/**
 * Updates the authenticated Family owner's name/sign-in email.
 * @param {{name: string, email: string, currentPassword?: string}} input - Values.
 * @returns {Promise<{user?: object, email?: string, requiresEmailVerification: boolean, message: string}>} Result.
 * @sideEffects May send verification mail and clear the server session.
 */
async function updateFamilyAccount(input) {
  const response = await api.patch(
    "/auth/account",
    input,
  );
  return response.data.data;
}

/**
 * Ends the current session.
 * @returns {Promise<{message: string}>} Server confirmation.
 * @sideEffects Clears the server session cookie.
 */
async function logout() {
  const response = await api.post("/auth/logout");
  return response.data.data;
}

/**
 * Verifies an email using the raw one-time token.
 * @param {string} token - Token from the emailed URL.
 * @returns {Promise<{message: string}>} Verification confirmation.
 * @sideEffects May mark User verified and token used.
 */
async function verifyEmail(token) {
  const requestOptions = {
    params: {
      token,
    },
  };
  const response = await api.get(
    "/auth/verify-email",
    requestOptions,
  );
  return response.data.data;
}

/**
 * Requests a replacement verification link.
 * @param {string} email - Unverified account email.
 * @returns {Promise<{message: string}>} Enumeration-safe confirmation.
 * @sideEffects May replace a token and send email.
 */
async function resendVerification(email) {
  const requestBody = {
    email,
  };
  const response = await api.post(
    "/auth/resend-verification",
    requestBody,
  );
  return response.data.data;
}

/**
 * Requests a one-hour password-reset email.
 * @param {string} email - Password account email.
 * @returns {Promise<{message: string}>} Neutral confirmation.
 * @sideEffects May replace a reset token and send email.
 */
async function forgotPassword(email) {
  const requestBody = {
    email,
  };
  const response = await api.post(
    "/auth/forgot-password",
    requestBody,
  );
  return response.data.data;
}

/**
 * Replaces a password using an emailed one-time token.
 * @param {{token: string, password: string, confirmPassword: string}} input - Reset data.
 * @returns {Promise<{message: string}>} Password-update confirmation.
 * @sideEffects Updates password, consumes token, and clears server session.
 */
async function resetPassword(input) {
  const response = await api.post(
    "/auth/reset-password",
    input,
  );
  return response.data.data;
}

export const authService = {
  signup,
  caregiverSignup,
  login,
  loginWithGoogle,
  getCurrentUser,
  updateFamilyAccount,
  logout,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
};
