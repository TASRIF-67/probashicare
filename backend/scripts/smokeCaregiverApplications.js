import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import app from "../app.js";
import { connectDatabase } from "../config/database.js";
import { validateEnvironment } from "../config/env.js";
import { CaregiverProfile } from "../models/CaregiverProfile.js";
import { EmailVerificationToken } from "../models/EmailVerificationToken.js";
import { User } from "../models/User.js";

const markerEmail = `caregiver-smoke-${Date.now()}@example.test`;
const password = "CaregiverSmokePassword2026";
let caregiverUser;
let caregiverProfile;
let server;

/**
 * Calls the ephemeral API and verifies the expected HTTP status.
 * @param {string} baseUrl - Ephemeral local server base URL.
 * @param {string} path - API path beginning with `/api`.
 * @param {{method?: string, body?: object, cookie?: string, expectedStatus?: number}} [options] - Request configuration.
 * @returns {Promise<{payload: object, cookie: string}>} Parsed payload and current session cookie.
 * @sideEffects Sends an HTTP request to the temporary local server.
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
 * Exercises caregiver draft, submission, rejection, resubmission, approval, and profile-update gates.
 * @param {void} _unused - Uses configured development admin credentials.
 * @returns {Promise<void>}
 * @sideEffects Creates temporary MongoDB records and starts an ephemeral HTTP server.
 */
async function runSmokeTest() {
  validateEnvironment();
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required for the caregiver smoke test.");
  }
  await connectDatabase();
  caregiverUser = await User.create({
    name: "Caregiver Smoke Applicant",
    email: markerEmail,
    password: await bcrypt.hash(password, 12),
    role: "caregiver",
    isVerified: true,
  });
  caregiverProfile = await CaregiverProfile.create({
    userId: caregiverUser._id,
    phone: "+880 1700 000000",
    applicationStatus: "draft",
  });

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const caregiverLogin = await callApi(baseUrl, "/api/auth/login", {
    method: "POST",
    body: { email: markerEmail, password },
  });
  if (caregiverLogin.payload.data.user.caregiverApplicationStatus !== "draft") {
    throw new Error("New caregiver login did not return draft application status.");
  }
  await CaregiverProfile.deleteOne({ _id: caregiverProfile._id });
  caregiverProfile = null;
  const missingProfileApplication = await callApi(baseUrl, "/api/caregivers/application", {
    cookie: caregiverLogin.cookie,
  });
  if (missingProfileApplication.payload.data.application.applicationStatus !== "draft") {
    throw new Error("A missing caregiver profile did not fall back to a draft application.");
  }

  const completeApplication = {
    phone: "+880 1700 000000",
    bio: "Experienced elder-care professional used by the automated development test.",
    skills: ["Medication support", "Mobility assistance"],
    languages: ["Bangla", "English"],
    yearsOfExperience: 4,
    hourlyRate: 650,
    monthlyRate: 45000,
    serviceArea: "Dhanmondi, Dhaka",
    availability: [{ day: "monday", startTime: "09:00", endTime: "17:00" }],
  };
  await callApi(baseUrl, "/api/caregivers/application/draft", {
    method: "PUT",
    cookie: caregiverLogin.cookie,
    body: completeApplication,
  });
  caregiverProfile = await CaregiverProfile.findOne({ userId: caregiverUser._id });
  if (!caregiverProfile) throw new Error("Saving a draft did not recreate the missing profile.");
  await callApi(baseUrl, "/api/caregivers/application/submit", {
    method: "POST",
    cookie: caregiverLogin.cookie,
    body: completeApplication,
  });
  const submittedSession = await callApi(baseUrl, "/api/auth/me", {
    cookie: caregiverLogin.cookie,
  });
  if (submittedSession.payload.data.user.caregiverApplicationStatus !== "submitted") {
    throw new Error("Submitted caregiver was not routed to review status.");
  }

  const adminLogin = await callApi(baseUrl, "/api/auth/login", {
    method: "POST",
    body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD },
  });
  const submittedList = await callApi(
    baseUrl,
    "/api/admin/caregiver-applications?status=submitted",
    { cookie: adminLogin.cookie },
  );
  if (!submittedList.payload.data.applications.some((item) => item._id === caregiverProfile._id.toString())) {
    throw new Error("Submitted caregiver was absent from the admin queue.");
  }
  await callApi(baseUrl, `/api/admin/caregiver-applications/${caregiverProfile._id}/reject`, {
    method: "PATCH",
    cookie: adminLogin.cookie,
    body: { reason: "Provide a clearer description of mobility-care experience." },
  });
  const rejectedSession = await callApi(baseUrl, "/api/auth/me", {
    cookie: caregiverLogin.cookie,
  });
  if (rejectedSession.payload.data.user.caregiverApplicationStatus !== "rejected") {
    throw new Error("Rejected caregiver did not receive rejected application status.");
  }

  await callApi(baseUrl, "/api/caregivers/application/submit", {
    method: "POST",
    cookie: caregiverLogin.cookie,
    body: { ...completeApplication, bio: `${completeApplication.bio} Updated after review.` },
  });
  await callApi(baseUrl, `/api/admin/caregiver-applications/${caregiverProfile._id}/approve`, {
    method: "PATCH",
    cookie: adminLogin.cookie,
  });
  const approvedSession = await callApi(baseUrl, "/api/auth/me", {
    cookie: caregiverLogin.cookie,
  });
  if (approvedSession.payload.data.user.caregiverApplicationStatus !== "approved") {
    throw new Error("Approved caregiver did not receive dashboard access status.");
  }
  const updated = await callApi(baseUrl, "/api/caregivers/profile", {
    method: "PUT",
    cookie: caregiverLogin.cookie,
    body: { ...completeApplication, hourlyRate: 700 },
  });
  if (updated.payload.data.application.hourlyRate !== 700) {
    throw new Error("Approved caregiver profile update was not persisted.");
  }

  console.log("Caregiver application workflow smoke test passed.");
}

/**
 * Closes resources and deletes only records created by this smoke test.
 * @param {void} _unused - Uses captured temporary record identifiers.
 * @returns {Promise<void>}
 * @sideEffects Stops the local server, deletes temporary MongoDB records, and disconnects Mongoose.
 */
async function cleanup() {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (caregiverUser) {
    await CaregiverProfile.deleteMany({ userId: caregiverUser._id });
    await EmailVerificationToken.deleteMany({ userId: caregiverUser._id });
    await User.deleteOne({ _id: caregiverUser._id });
  }
  await mongoose.disconnect();
}

runSmokeTest()
  .catch((error) => {
    console.error("Caregiver application workflow smoke test failed:", error.message);
    process.exitCode = 1;
  })
  .finally(cleanup);
