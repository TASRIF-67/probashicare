import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDatabase } from "../config/database.js";
import { env, validateEnvironment } from "../config/env.js";
import { ElderlyFamilyLink } from "../models/ElderlyFamilyLink.js";
import { ElderlyProfile } from "../models/ElderlyProfile.js";
import { User } from "../models/User.js";

const baseUrl = `http://localhost:${env.port}/api`;
const marker = `smoke-${Date.now()}`;
const password = "SmokeTestPassword2026";
let firstUser;
let secondUser;
let profileId;

/**
 * Calls the running API and enforces an expected status.
 * @param {string} path - API path beginning with `/`.
 * @param {{method?: string, body?: object, cookie?: string, expectedStatus?: number}} [options] - Request configuration.
 * @returns {Promise<{payload: object, cookie: string}>} Parsed JSON and returned session cookie.
 * @sideEffects Makes an HTTP request to the local development API.
 */
async function callApi(path, { method = "GET", body, cookie, expectedStatus = 200 } = {}) {
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
 * Creates a verified temporary family directly so the smoke test can focus on profile APIs.
 * @param {string} email - Unique temporary email.
 * @returns {Promise<import("../models/User.js").User>} Created family User.
 * @sideEffects Hashes a password and writes a temporary User to MongoDB.
 */
async function createTemporaryFamily(email) {
  return User.create({
    name: "Profile Smoke Family",
    email,
    password: await bcrypt.hash(password, 12),
    role: "family",
    isVerified: true,
  });
}

/**
 * Exercises profile creation, ownership isolation, updates, listing, archive, and auth status.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<void>}
 * @sideEffects Creates and removes temporary Atlas records and calls the local API.
 */
async function runSmokeTest() {
  validateEnvironment();
  await connectDatabase();
  firstUser = await createTemporaryFamily(`${marker}-owner@example.test`);
  secondUser = await createTemporaryFamily(`${marker}-other@example.test`);

  const ownerLogin = await callApi("/auth/login", {
    method: "POST",
    body: { email: firstUser.email, password },
  });
  const otherLogin = await callApi("/auth/login", {
    method: "POST",
    body: { email: secondUser.email, password },
  });

  const created = await callApi("/elderly-profiles", {
    method: "POST",
    cookie: ownerLogin.cookie,
    expectedStatus: 201,
    body: {
      personalInformation: {
        fullName: "Smoke Test Relative",
        preferredName: "Relative",
        dateOfBirth: "1950-01-01",
        gender: "female",
        bloodGroup: "O+",
        phone: "+880 1700 000000",
        address: "Development address",
        district: "Dhaka",
        division: "Dhaka",
        preferredLanguage: "Bangla",
        familyRelationship: "daughter",
        careNotes: "Temporary automated test record",
      },
      medicalHistory: [{ condition: "Test condition", status: "managed" }],
      allergies: [{ allergen: "Test allergen", type: "other", severity: "mild" }],
      medications: [{ name: "Test medicine", dosage: "Once daily", isActive: true }],
      chronicDiseases: [{ name: "Test chronic condition", status: "active" }],
      emergencyContacts: [{
        name: "Test Contact",
        relationship: "relative",
        phone: "+880 1800 000000",
        priority: 1,
        isPrimary: true,
      }],
    },
  });
  profileId = created.payload.data.profile._id;

  const linkedSession = await callApi("/auth/me", { cookie: ownerLogin.cookie });
  if (!linkedSession.payload.data.user.hasLinkedElderlyProfiles) {
    throw new Error("Authentication response did not detect the newly linked elderly profile.");
  }
  const listed = await callApi("/elderly-profiles", { cookie: ownerLogin.cookie });
  if (listed.payload.data.count !== 1) {
    throw new Error("The owner profile list did not contain the created profile.");
  }
  await callApi(`/elderly-profiles/${profileId}`, {
    cookie: otherLogin.cookie,
    expectedStatus: 404,
  });
  await callApi(`/elderly-profiles/${profileId}`, {
    method: "PUT",
    cookie: ownerLogin.cookie,
    body: {
      ...created.payload.data.profile,
      personalInformation: {
        ...created.payload.data.profile.personalInformation,
        preferredName: "Updated Relative",
      },
    },
  });
  await callApi(`/elderly-profiles/${profileId}/archive`, {
    method: "PATCH",
    cookie: ownerLogin.cookie,
  });
  const archivedSession = await callApi("/auth/me", { cookie: ownerLogin.cookie });
  if (archivedSession.payload.data.user.hasLinkedElderlyProfiles) {
    throw new Error("Archived-only family was incorrectly treated as onboarded.");
  }

  console.log("Elderly profile API smoke test passed.");
}

/**
 * Removes every temporary document created by the smoke test.
 * @param {void} _unused - Uses IDs captured during the test.
 * @returns {Promise<void>}
 * @sideEffects Permanently deletes only marker-owned smoke-test records from MongoDB.
 */
async function cleanup() {
  if (profileId) {
    await ElderlyFamilyLink.deleteMany({ elderlyProfileId: profileId });
    await ElderlyProfile.deleteOne({ _id: profileId });
  }
  await User.deleteMany({ email: { $regex: `^${marker}` } });
  await mongoose.disconnect();
}

runSmokeTest()
  .catch((error) => {
    console.error("Elderly profile API smoke test failed:", error.message);
    process.exitCode = 1;
  })
  .finally(cleanup);
