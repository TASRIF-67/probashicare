import { api } from "./api.js";

/**
 * Creates an unverified family account.
 * @param {{name: string, email: string, password: string}} input - Signup form values.
 * @returns {Promise<{message: string, email: string}>} Verification instructions and normalized email.
 * @sideEffects Calls POST `/auth/signup`, creating a user and sending email.
 */
async function signup(input) {
  const response = await api.post("/auth/signup", input);
  return response.data.data;
}

/**
 * Starts an email/password session.
 * @param {{email: string, password: string}} input - Login credentials.
 * @returns {Promise<{user: object}>} Authenticated public user payload.
 * @sideEffects Calls POST `/auth/login` and receives an HTTP-only cookie.
 */
async function login(input) {
  const response = await api.post("/auth/login", input);
  return response.data.data;
}

/**
 * Starts or creates a family session from Google Identity Services.
 * @param {string} credential - Google ID token.
 * @returns {Promise<{user: object}>} Authenticated public user payload.
 * @sideEffects Calls POST `/auth/google`; may create/link a user and set a cookie.
 */
async function loginWithGoogle(credential) {
  const response = await api.post("/auth/google", { credential });
  return response.data.data;
}

/**
 * Retrieves the current cookie-backed session.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<{user: object}>} Current public user payload.
 * @sideEffects Calls GET `/auth/me`.
 */
async function getCurrentUser() {
  const response = await api.get("/auth/me");
  return response.data.data;
}

/**
 * Ends the current session.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<{message: string}>} Server confirmation.
 * @sideEffects Calls POST `/auth/logout` and clears the session cookie.
 */
async function logout() {
  const response = await api.post("/auth/logout");
  return response.data.data;
}

/**
 * Verifies an email using a one-time token.
 * @param {string} token - Token from the emailed link.
 * @returns {Promise<{message: string}>} Verification confirmation.
 * @sideEffects Calls GET `/auth/verify-email` and updates the user in the database.
 */
async function verifyEmail(token) {
  const response = await api.get("/auth/verify-email", { params: { token } });
  return response.data.data;
}

/**
 * Requests a replacement verification link.
 * @param {string} email - Unverified account email.
 * @returns {Promise<{message: string}>} Enumeration-safe confirmation.
 * @sideEffects Calls POST `/auth/resend-verification` and may send email.
 */
async function resendVerification(email) {
  const response = await api.post("/auth/resend-verification", { email });
  return response.data.data;
}

/*
 * To add a similar frontend API, create a typed-by-documentation method here or in
 * a feature service, return only `response.data.data`, expose it through a context
 * or custom hook, then consume that abstraction from the route-level page.
 */
export const authService = {
  signup,
  login,
  loginWithGoogle,
  getCurrentUser,
  logout,
  verifyEmail,
  resendVerification,
};
