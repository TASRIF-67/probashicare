import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import app from "../app.js";
import { connectDatabase } from "../config/database.js";
import { validateEnvironment } from "../config/env.js";
import { CareAssignment } from "../models/CareAssignment.js";
import { CaregiverProfile } from "../models/CaregiverProfile.js";
import { ElderlyFamilyLink } from "../models/ElderlyFamilyLink.js";
import { ElderlyProfile } from "../models/ElderlyProfile.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { WellnessReport } from "../models/WellnessReport.js";

const marker = `wellness-smoke-${Date.now()}`;
const password = "WellnessSmokePassword2026";
const createdUserIds = [];
let elderlyProfile;
let careAssignment;
let server;

/**
 * Calls the ephemeral API and verifies the expected status code.
 * @param {string} baseUrl - Temporary local API base URL.
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
 * Creates a verified smoke-test user with a hashed local password.
 * @param {{name: string, role: "family"|"caregiver", suffix: string}} input - User identity and marker suffix.
 * @returns {Promise<import("../models/User.js").User>} Created User document.
 * @sideEffects Writes one User document to MongoDB and records it for cleanup.
 */
async function createTestUser({ name, role, suffix }) {
  const user = await User.create({
    name,
    email: `${marker}-${suffix}@example.test`,
    password: await bcrypt.hash(password, 12),
    role,
    isVerified: true,
  });
  createdUserIds.push(user._id);
  return user;
}

/**
 * Exercises draft, submission, assignment, family visibility, trend, and isolation rules.
 * @param {void} _unused - The smoke test accepts no arguments.
 * @returns {Promise<void>}
 * @sideEffects Creates temporary users, profiles, links, assignments, reports, and an ephemeral API server.
 */
async function runSmokeTest() {
  validateEnvironment();
  await connectDatabase();
  const [family, unrelatedFamily, caregiver, unrelatedCaregiver] = await Promise.all([
    createTestUser({ name: "Wellness Family", role: "family", suffix: "family" }),
    createTestUser({ name: "Unrelated Family", role: "family", suffix: "other-family" }),
    createTestUser({ name: "Wellness Caregiver", role: "caregiver", suffix: "caregiver" }),
    createTestUser({ name: "Other Caregiver", role: "caregiver", suffix: "other-caregiver" }),
  ]);
  await CaregiverProfile.create([
    { userId: caregiver._id, phone: "+880 1700 111111", applicationStatus: "approved" },
    { userId: unrelatedCaregiver._id, phone: "+880 1700 222222", applicationStatus: "approved" },
  ]);
  elderlyProfile = await ElderlyProfile.create({
    createdBy: family._id,
    personalInformation: {
      fullName: "Wellness Test Elder",
      dateOfBirth: new Date("1945-04-20"),
      gender: "female",
      bloodGroup: "O+",
      address: "Test Road",
      district: "Dhaka",
      division: "Dhaka",
      familyRelationship: "Mother",
    },
  });
  await ElderlyFamilyLink.create({
    elderlyProfileId: elderlyProfile._id,
    familyUserId: family._id,
    relationship: "Mother",
    permission: "owner",
    linkedBy: family._id,
    status: "active",
  });
  careAssignment = await CareAssignment.create({
    elderlyProfileId: elderlyProfile._id,
    caregiverUserId: caregiver._id,
    assignmentType: "one-time",
    startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: "active",
  });

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const logins = await Promise.all(
    [family, unrelatedFamily, caregiver, unrelatedCaregiver].map((user) =>
      callApi(baseUrl, "/api/auth/login", {
        method: "POST",
        body: { email: user.email, password },
      }),
    ),
  );
  const [familyLogin, unrelatedFamilyLogin, caregiverLogin, unrelatedCaregiverLogin] = logins;

  const assignments = await callApi(baseUrl, "/api/wellness-reports/assignments", {
    cookie: caregiverLogin.cookie,
  });
  if (assignments.payload.data.count !== 1) {
    throw new Error("Assigned caregiver did not receive the reportable visit.");
  }

  const now = new Date();
  const completePayload = {
    careAssignmentId: careAssignment._id.toString(),
    elderlyProfileId: elderlyProfile._id.toString(),
    visitDate: now.toISOString(),
    checkInAt: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
    checkOutAt: now.toISOString(),
    mood: "good",
    mealStatus: "full",
    mealNotes: "Ate the planned meal.",
    medicineIntakeStatus: "all-taken",
    medicineNotes: "Daily medicine summary confirmed.",
    vitals: {
      systolic: 124,
      diastolic: 78,
      bloodSugar: 108,
      bloodSugarContext: "after-meal",
      weightKg: 61.5,
      measuredAt: now.toISOString(),
    },
    exerciseDurationMinutes: 20,
    observations: "Alert, comfortable, and conversing normally.",
    caregiverNotes: "Continue normal routine.",
    nextVisitDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
  };
  await callApi(baseUrl, "/api/wellness-reports", {
    method: "POST",
    cookie: unrelatedCaregiverLogin.cookie,
    body: completePayload,
    expectedStatus: 404,
  });
  const created = await callApi(baseUrl, "/api/wellness-reports", {
    method: "POST",
    cookie: caregiverLogin.cookie,
    body: completePayload,
    expectedStatus: 201,
  });
  const reportId = created.payload.data.report._id;
  if (created.payload.data.report.status !== "draft") {
    throw new Error("New wellness report was not created as a draft.");
  }

  const hiddenDrafts = await callApi(
    baseUrl,
    `/api/wellness-reports/elderly/${elderlyProfile._id}`,
    { cookie: familyLogin.cookie },
  );
  if (hiddenDrafts.payload.data.pagination.total !== 0) {
    throw new Error("Family could see a caregiver draft before submission.");
  }
  await callApi(baseUrl, `/api/wellness-reports/${reportId}`, {
    method: "PUT",
    cookie: caregiverLogin.cookie,
    body: { ...completePayload, observations: "Updated final health observation." },
  });
  await callApi(baseUrl, `/api/wellness-reports/${reportId}/submit`, {
    method: "POST",
    cookie: caregiverLogin.cookie,
  });
  await callApi(baseUrl, `/api/wellness-reports/${reportId}`, {
    method: "PUT",
    cookie: caregiverLogin.cookie,
    body: completePayload,
    expectedStatus: 404,
  });

  const familyReports = await callApi(
    baseUrl,
    `/api/wellness-reports/elderly/${elderlyProfile._id}`,
    { cookie: familyLogin.cookie },
  );
  if (familyReports.payload.data.pagination.total !== 1) {
    throw new Error("Linked family did not receive the submitted report.");
  }
  const familyNotification = await Notification.findOne({
    recipientUserId: family._id,
    relatedEntityId: reportId,
    type: "wellness-report-submitted",
  });
  if (!familyNotification) {
    throw new Error("Submitted wellness report did not notify the linked family.");
  }
  const trends = await callApi(
    baseUrl,
    `/api/wellness-reports/elderly/${elderlyProfile._id}/vitals`,
    { cookie: familyLogin.cookie },
  );
  if (trends.payload.data.points.length !== 1 || trends.payload.data.points[0].systolic !== 124) {
    throw new Error("Submitted vitals were absent from the family trend response.");
  }
  await callApi(baseUrl, `/api/wellness-reports/elderly/${elderlyProfile._id}`, {
    cookie: unrelatedFamilyLogin.cookie,
    expectedStatus: 404,
  });
  await callApi(baseUrl, `/api/wellness-reports/${reportId}`, {
    cookie: unrelatedCaregiverLogin.cookie,
    expectedStatus: 404,
  });

  console.log("Wellness report and vitals workflow smoke test passed.");
}

/**
 * Stops resources and removes every document owned by this smoke-test marker.
 * @param {void} _unused - Cleanup uses record identifiers captured during the test.
 * @returns {Promise<void>}
 * @sideEffects Stops the API server, deletes temporary MongoDB records, and disconnects Mongoose.
 */
async function cleanup() {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (elderlyProfile) {
    await WellnessReport.deleteMany({ elderlyProfileId: elderlyProfile._id });
    await CareAssignment.deleteMany({ elderlyProfileId: elderlyProfile._id });
    await ElderlyFamilyLink.deleteMany({ elderlyProfileId: elderlyProfile._id });
    await ElderlyProfile.deleteOne({ _id: elderlyProfile._id });
  }
  if (createdUserIds.length) {
    await Notification.deleteMany({
      recipientUserId: {
        $in: createdUserIds,
      },
    });
    await CaregiverProfile.deleteMany({ userId: { $in: createdUserIds } });
    await User.deleteMany({ _id: { $in: createdUserIds } });
  }
  await mongoose.disconnect();
}

runSmokeTest()
  .catch((error) => {
    console.error("Wellness report and vitals workflow smoke test failed:", error.message);
    process.exitCode = 1;
  })
  .finally(cleanup);
