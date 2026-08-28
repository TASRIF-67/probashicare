import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import app from "../app.js";
import { connectDatabase } from "../config/database.js";
import { validateEnvironment } from "../config/env.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { createNotification } from "../services/notificationService.js";

// `Date.now` returns the current millisecond timestamp. It makes every fixture
// email and event key unique, even when the smoke test runs repeatedly.
const marker = "notification-smoke-" + Date.now();
const password = "NotificationSmokePassword2026";

let server = null;
let baseUrl = "";
const createdUserIds = [];

/**
 * Starts the Express app on a random available local port.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<void>} Resolves when the server begins listening.
 * @sideEffects Opens a temporary local HTTP listener.
 */
async function startServer() {
  await new Promise((resolve, reject) => {
    server = app.listen(0, "127.0.0.1");

    server.once("listening", resolve);
    server.once("error", reject);
  });

  const address = server.address();
  baseUrl = "http://127.0.0.1:" + address.port + "/api";
}

/**
 * Stops the temporary Express server.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<void>} Resolves after the listener closes.
 * @sideEffects Closes the temporary local HTTP listener.
 */
async function stopServer() {
  if (!server) {
    return;
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  server = null;
}

/**
 * Calls the local API and checks the expected HTTP status.
 * @param {string} path - API path beginning with a slash.
 * @param {{
 *   method?: string,
 *   body?: object,
 *   cookie?: string,
 *   expectedStatus?: number
 * }} [options] - HTTP request settings.
 * @returns {Promise<{payload: object, cookie: string}>} Parsed JSON and session cookie.
 * @sideEffects Makes an HTTP request to the temporary Express server.
 */
async function callApi(
  path,
  { method = "GET", body, cookie, expectedStatus = 200 } = {},
) {
  const headers = {};

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  if (cookie) {
    headers.Cookie = cookie;
  }

  let requestBody;

  if (body) {
    // `JSON.stringify` converts an object into JSON request text.
    requestBody = JSON.stringify(body);
  }

  // `fetch` returns a Promise for the HTTP response.
  const response = await fetch(baseUrl + path, {
    method,
    headers,
    body: requestBody,
  });

  // `response.json` reads and parses the JSON response body.
  const payload = await response.json();

  if (response.status !== expectedStatus) {
    throw new Error(
      method +
        " " +
        path +
        " returned " +
        response.status +
        ": " +
        JSON.stringify(payload),
    );
  }

  let responseCookie = cookie || "";
  const setCookieHeader = response.headers.get("set-cookie");

  if (setCookieHeader) {
    // `split` creates pieces at semicolons. The first piece is the session
    // cookie without Path, HttpOnly, SameSite, and other attributes.
    responseCookie = setCookieHeader.split(";")[0];
  }

  return {
    payload,
    cookie: responseCookie,
  };
}

/**
 * Creates one verified temporary family user.
 * @param {string} emailPrefix - Unique email prefix.
 * @returns {Promise<import("mongoose").Document>} Created User document.
 * @sideEffects Hashes a password and inserts one User in MongoDB.
 */
async function createTemporaryFamily(emailPrefix) {
  // Password hashing is asynchronous because the cost factor deliberately
  // performs CPU work to slow password guessing.
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await User.create({
    name: "Notification Smoke Family",
    email: emailPrefix + "@example.test",
    password: passwordHash,
    role: "family",
    isVerified: true,
  });

  createdUserIds.push(user._id);
  return user;
}

/**
 * Logs a temporary user in and returns the HTTP-only session cookie.
 * @param {import("mongoose").Document} user - Temporary User document.
 * @returns {Promise<string>} Session cookie value.
 * @sideEffects Calls the authentication API.
 */
async function login(user) {
  const result = await callApi("/auth/login", {
    method: "POST",
    body: {
      email: user.email,
      password,
    },
  });

  return result.cookie;
}

/**
 * Creates an idempotent fixture notification.
 * @param {{
 *   recipientUserId: import("mongoose").Types.ObjectId,
 *   eventSuffix: string,
 *   type?: string
 * }} input - Recipient and unique event information.
 * @returns {Promise<import("mongoose").Document>} Created or reused notification.
 * @sideEffects Upserts one Notification document.
 */
async function createFixtureNotification(input) {
  const type = input.type || "booking-requested";

  return createNotification({
    recipientUserId: input.recipientUserId,
    actorUserId: null,
    type,
    priority: "normal",
    title: "Smoke notification",
    message: "Temporary notification integration test.",
    actionPath: "/notifications",
    relatedEntityType: "User",
    relatedEntityId: input.recipientUserId,
    eventKey: marker + "-" + input.eventSuffix,
  });
}

/**
 * Exercises authenticated notification isolation, idempotency, read, and bulk read.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<void>} Resolves after every assertion succeeds.
 * @sideEffects Creates temporary users/notifications and calls local APIs.
 */
async function runSmokeTest() {
  validateEnvironment();
  await connectDatabase();
  await startServer();

  const firstUser = await createTemporaryFamily(marker + "-first");
  const secondUser = await createTemporaryFamily(marker + "-second");

  const firstCookie = await login(firstUser);
  const secondCookie = await login(secondUser);

  const firstNotification = await createFixtureNotification({
    recipientUserId: firstUser._id,
    eventSuffix: "first-event",
  });

  // Repeating the same user and event key must reuse the existing document.
  const repeatedNotification = await createFixtureNotification({
    recipientUserId: firstUser._id,
    eventSuffix: "first-event",
  });

  assert.equal(
    firstNotification._id.toString(),
    repeatedNotification._id.toString(),
  );

  await createFixtureNotification({
    recipientUserId: secondUser._id,
    eventSuffix: "second-event",
  });

  const firstList = await callApi("/notifications?page=1&limit=20", {
    cookie: firstCookie,
  });

  assert.equal(firstList.payload.data.notifications.length, 1);
  assert.equal(
    firstList.payload.data.notifications[0].recipient,
    firstUser._id.toString(),
  );

  // Another authenticated user receives a concealed 404 for this ID.
  await callApi("/notifications/" + firstNotification._id + "/read", {
    method: "PATCH",
    cookie: secondCookie,
    expectedStatus: 404,
  });

  const markedRead = await callApi(
    "/notifications/" + firstNotification._id + "/read",
    {
      method: "PATCH",
      cookie: firstCookie,
    },
  );

  assert.equal(markedRead.payload.data.notification.isRead, true);

  await createFixtureNotification({
    recipientUserId: firstUser._id,
    eventSuffix: "bulk-event",
    type: "wellness-report-submitted",
  });

  const bulkResult = await callApi("/notifications/read-all", {
    method: "PATCH",
    cookie: firstCookie,
  });

  assert.equal(bulkResult.payload.data.unreadCount, 0);

  const unreadList = await callApi("/notifications?unread=true", {
    cookie: firstCookie,
  });

  assert.equal(unreadList.payload.data.notifications.length, 0);

  const fixtureCount = await Notification.countDocuments({
    eventKey: {
      $regex: "^" + marker,
    },
  });

  // There are three unique recipient/event combinations. The repeated call did
  // not insert a fourth document.
  assert.equal(fixtureCount, 3);
}

/**
 * Removes only fixtures created by this smoke-test marker.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<void>} Resolves after fixture deletion.
 * @sideEffects Deletes temporary Notification and User documents.
 */
async function cleanup() {
  await Notification.deleteMany({
    eventKey: {
      $regex: "^" + marker,
    },
  });

  if (createdUserIds.length > 0) {
    await User.deleteMany({
      _id: {
        $in: createdUserIds,
      },
    });
  }
}

/**
 * Runs the smoke test with guaranteed cleanup and disconnection.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<void>} Resolves after successful verification.
 * @sideEffects Connects to MongoDB, opens a server, logs output, and cleans fixtures.
 */
async function startSmokeTest() {
  try {
    await runSmokeTest();
    console.log("Authenticated notification smoke test passed.");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    try {
      await cleanup();
    } finally {
      await stopServer();
      await mongoose.disconnect();
    }
  }
}

startSmokeTest();
