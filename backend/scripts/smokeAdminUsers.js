import mongoose from "mongoose";
import app from "../app.js";
import { connectDatabase } from "../config/database.js";
import { validateEnvironment } from "../config/env.js";
import { EmailVerificationToken } from "../models/EmailVerificationToken.js";
import { User } from "../models/User.js";

const markerEmail = `admin-delete-check-${Date.now()}@example.test`;
let temporaryUser;
let server;

/**
 * Calls the ephemeral smoke-test API and enforces its expected status.
 * @param {string} baseUrl - Ephemeral server base URL.
 * @param {string} path - API path beginning with `/api`.
 * @param {{method?: string, body?: object, cookie?: string, expectedStatus?: number}} [options] - HTTP configuration.
 * @returns {Promise<{payload: object, cookie: string}>} Parsed response and session cookie.
 * @sideEffects Sends an HTTP request to the local ephemeral server.
 */
async function callApi(
  baseUrl,
  path,
  { method = "GET", body, cookie, expectedStatus = 200 } = {},
) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (response.status !== expectedStatus) {
    throw new Error(`${method} ${path} returned ${response.status}: ${JSON.stringify(payload)}`);
  }
  return {
    payload,
    cookie: response.headers.get("set-cookie")?.split(";")[0] || cookie || "",
  };
}

/**
 * Verifies that an admin can list and delete an unlinked temporary family account.
 * @param {void} _unused - Uses admin credentials from backend environment variables.
 * @returns {Promise<void>}
 * @sideEffects Creates and deletes a temporary User and starts an ephemeral local HTTP server.
 */
async function runSmokeTest() {
  validateEnvironment();
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required for the admin smoke test.");
  }
  await connectDatabase();
  temporaryUser = await User.create({
    name: "Admin Delete Check",
    email: markerEmail,
    role: "family",
    isVerified: false,
  });

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const login = await callApi(baseUrl, "/api/auth/login", {
    method: "POST",
    body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
  });
  const overview = await callApi(baseUrl, "/api/admin/overview", { cookie: login.cookie });
  if (typeof overview.payload.data.metrics.totalFamilies !== "number") {
    throw new Error("Admin overview did not return numeric family metrics.");
  }
  const listed = await callApi(baseUrl, "/api/admin/users", { cookie: login.cookie });
  if (!listed.payload.data.users.some((user) => user.id === temporaryUser._id.toString())) {
    throw new Error("Temporary family account was absent from the admin list.");
  }
  await callApi(baseUrl, `/api/admin/users/${temporaryUser._id}`, {
    method: "DELETE",
    cookie: login.cookie,
  });
  temporaryUser = null;
  console.log("Admin family-account management smoke test passed.");
}

/**
 * Closes resources and removes the temporary account if a test assertion failed.
 * @param {void} _unused - Uses resources captured during the test.
 * @returns {Promise<void>}
 * @sideEffects Closes HTTP/MongoDB connections and deletes only the marker-owned account.
 */
async function cleanup() {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (temporaryUser) {
    await EmailVerificationToken.deleteMany({ userId: temporaryUser._id });
    await User.deleteOne({ _id: temporaryUser._id });
  }
  await mongoose.disconnect();
}

runSmokeTest()
  .catch((error) => {
    console.error("Admin family-account management smoke test failed:", error.message);
    process.exitCode = 1;
  })
  .finally(cleanup);
