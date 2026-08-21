import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import app from "../app.js";
import { connectDatabase } from "../config/database.js";
import { validateEnvironment } from "../config/env.js";
import { CareAssignment } from "../models/CareAssignment.js";
import { CaregiverProfile } from "../models/CaregiverProfile.js";
import { ElderlyFamilyLink } from "../models/ElderlyFamilyLink.js";
import { ElderlyProfile } from "../models/ElderlyProfile.js";
import { GroceryRequest } from "../models/GroceryRequest.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";

const marker = `grocery-smoke-${Date.now()}`;
const password = "GrocerySmokePassword2026";
const createdUserIds = [];
let elderlyProfile;
let careAssignment;
let server;

/**
 * Calls the temporary authenticated API and verifies its HTTP status.
 * @param {string} baseUrl - Temporary server base URL.
 * @param {string} path - API path beginning with /api.
 * @param {{method?: string, body?: object, cookie?: string, expectedStatus?: number}} [options] - Request settings.
 * @returns {Promise<{payload: object, cookie: string}>} Parsed response and session cookie.
 * @sideEffects Performs one local HTTP request.
 */
async function callApi(
  baseUrl,
  path,
  { method = "GET", body, cookie, expectedStatus = 200 } = {},
) {
  const response = await fetch(baseUrl + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();

  if (response.status !== expectedStatus) {
    throw new Error(
      method
      + " "
      + path
      + " returned "
      + response.status
      + ": "
      + JSON.stringify(payload),
    );
  }

  return {
    payload,
    cookie: response.headers.get("set-cookie")?.split(";")[0] || cookie || "",
  };
}

/**
 * Creates one verified family or caregiver smoke-test identity.
 * @param {{name: string, role: "family"|"caregiver", suffix: string}} input - Test identity values.
 * @returns {Promise<import("mongoose").Document>} Created User record.
 * @sideEffects Hashes a password, writes MongoDB, and records the user for cleanup.
 */
async function createTestUser(input) {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name: input.name,
    email: marker + "-" + input.suffix + "@example.test",
    password: passwordHash,
    role: input.role,
    isVerified: true,
  });
  createdUserIds.push(user._id);
  return user;
}

/**
 * Logs a created test identity into the temporary API.
 * @param {string} baseUrl - Temporary server base URL.
 * @param {import("mongoose").Document} user - Created User record.
 * @returns {Promise<string>} Authentication cookie value.
 * @sideEffects Creates an authenticated server session cookie.
 */
async function loginTestUser(baseUrl, user) {
  const result = await callApi(baseUrl, "/api/auth/login", {
    method: "POST",
    body: {
      email: user.email,
      password,
    },
  });
  return result.cookie;
}

/**
 * Builds the normal request body used by repeated workflow cases.
 * @param {string} assignmentId - Authorized CareAssignment identifier.
 * @param {string} profileId - Assigned ElderlyProfile identifier.
 * @returns {object} Complete grocery create-request contract.
 * @sideEffects None.
 */
function createRequestBody(assignmentId, profileId) {
  return {
    careAssignmentId: assignmentId,
    elderlyProfileId: profileId,
    urgency: "normal",
    neededBy: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    estimatedBudget: 1200,
    caregiverNote: "The household is running low before the next visit.",
    items: [
      {
        name: "Rice",
        category: "grocery",
        quantity: 2,
        unit: "kg",
        notes: "Regular local rice is fine.",
      },
      {
        name: "Soap",
        category: "personal-care",
        quantity: 2,
        unit: "item",
        notes: "",
      },
    ],
  };
}

/**
 * Exercises authorization, both fulfilment paths, concurrency, payment audit,
 * optional receipts, cancellation, notifications, and role-specific history.
 * @returns {Promise<void>}
 * @sideEffects Creates temporary MongoDB records and an ephemeral API server.
 */
async function runSmokeTest() {
  validateEnvironment();
  await connectDatabase();
  const family = await createTestUser({
    name: "Grocery Family",
    role: "family",
    suffix: "family",
  });
  const unrelatedFamily = await createTestUser({
    name: "Unrelated Family",
    role: "family",
    suffix: "unrelated-family",
  });
  const caregiver = await createTestUser({
    name: "Grocery Caregiver",
    role: "caregiver",
    suffix: "caregiver",
  });
  const unrelatedCaregiver = await createTestUser({
    name: "Unrelated Caregiver",
    role: "caregiver",
    suffix: "unrelated-caregiver",
  });
  await CaregiverProfile.create({
    userId: caregiver._id,
    phone: "+880 1700 300001",
    applicationStatus: "approved",
  });
  await CaregiverProfile.create({
    userId: unrelatedCaregiver._id,
    phone: "+880 1700 300002",
    applicationStatus: "approved",
  });
  elderlyProfile = await ElderlyProfile.create({
    createdBy: family._id,
    personalInformation: {
      fullName: "Grocery Test Elder",
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
    assignmentType: "long-term",
    startsAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: "active",
  });

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  const baseUrl = "http://127.0.0.1:" + server.address().port;
  const familyCookie = await loginTestUser(baseUrl, family);
  const unrelatedFamilyCookie = await loginTestUser(baseUrl, unrelatedFamily);
  const caregiverCookie = await loginTestUser(baseUrl, caregiver);
  const unrelatedCaregiverCookie = await loginTestUser(
    baseUrl,
    unrelatedCaregiver,
  );
  const requestBody = createRequestBody(
    careAssignment._id.toString(),
    elderlyProfile._id.toString(),
  );

  await callApi(
    baseUrl,
    "/api/store-locator/nearby?latitude=23.8&longitude=90.4",
    { expectedStatus: 401 },
  );
  await callApi(
    baseUrl,
    "/api/store-locator/nearby?latitude=invalid&longitude=90.4",
    {
      cookie: caregiverCookie,
      expectedStatus: 422,
    },
  );

  const assignments = await callApi(
    baseUrl,
    "/api/grocery-requests/assignments",
    { cookie: caregiverCookie },
  );

  if (assignments.payload.data.count !== 1) {
    throw new Error("Assigned caregiver did not receive an essentials choice.");
  }

  await callApi(baseUrl, "/api/grocery-requests", {
    method: "POST",
    cookie: unrelatedCaregiverCookie,
    body: requestBody,
    expectedStatus: 404,
  });
  await callApi(baseUrl, "/api/grocery-requests", {
    method: "POST",
    cookie: caregiverCookie,
    body: {
      ...requestBody,
      neededBy: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    },
    expectedStatus: 422,
  });

  const localCreated = await callApi(baseUrl, "/api/grocery-requests", {
    method: "POST",
    cookie: caregiverCookie,
    body: requestBody,
    expectedStatus: 201,
  });
  const localRequestId = localCreated.payload.data.request._id;

  const familyList = await callApi(
    baseUrl,
    "/api/grocery-requests/family/mine?page=1&limit=3",
    { cookie: familyCookie },
  );

  if (familyList.payload.data.pagination.total !== 1) {
    throw new Error("Linked family could not see the submitted request.");
  }

  const unrelatedList = await callApi(
    baseUrl,
    "/api/grocery-requests/family/mine?page=1&limit=3",
    { cookie: unrelatedFamilyCookie },
  );

  if (unrelatedList.payload.data.pagination.total !== 0) {
    throw new Error("Unrelated family could see a private essentials request.");
  }

  await callApi(
    baseUrl,
    "/api/grocery-requests/family/" + localRequestId + "/review",
    {
      method: "PATCH",
      cookie: unrelatedFamilyCookie,
      body: {
        decision: "approve",
        fulfillmentMethod: "caregiver-purchase",
        approvedBudget: 1300,
      },
      expectedStatus: 404,
    },
  );
  await callApi(
    baseUrl,
    "/api/grocery-requests/family/" + localRequestId + "/review",
    {
      method: "PATCH",
      cookie: familyCookie,
      body: {
        decision: "approve",
        fulfillmentMethod: "caregiver-purchase",
        approvedBudget: 1300,
        note: "Purchase locally and call if the price is higher.",
      },
    },
  );
  await callApi(
    baseUrl,
    "/api/grocery-requests/family/" + localRequestId + "/review",
    {
      method: "PATCH",
      cookie: familyCookie,
      body: {
        decision: "approve",
        fulfillmentMethod: "caregiver-purchase",
        approvedBudget: 1300,
      },
      expectedStatus: 409,
    },
  );
  await callApi(
    baseUrl,
    "/api/grocery-requests/caregiver/" + localRequestId + "/status",
    {
      method: "PATCH",
      cookie: caregiverCookie,
      body: { status: "purchasing" },
    },
  );
  await callApi(
    baseUrl,
    "/api/grocery-requests/caregiver/" + localRequestId + "/purchase",
    {
      method: "PATCH",
      cookie: caregiverCookie,
      body: {
        actualTotal: 0,
        paymentArrangement: "caregiver-paid-reimbursement-pending",
      },
      expectedStatus: 422,
    },
  );
  await callApi(
    baseUrl,
    "/api/grocery-requests/caregiver/" + localRequestId + "/purchase",
    {
      method: "PATCH",
      cookie: caregiverCookie,
      body: {
        actualTotal: 1090,
        paymentArrangement: "caregiver-paid-reimbursement-pending",
        purchaseNote: "Purchased from the neighbourhood shop.",
        selectedStore: {
          source: "manual",
          name: "Neighbourhood Store",
          address: "Local market",
        },
      },
    },
  );
  await callApi(
    baseUrl,
    "/api/grocery-requests/family/" + localRequestId + "/payment-settled",
    {
      method: "PATCH",
      cookie: familyCookie,
      body: { settled: true },
    },
  );
  await callApi(
    baseUrl,
    "/api/grocery-requests/caregiver/" + localRequestId + "/status",
    {
      method: "PATCH",
      cookie: caregiverCookie,
      body: { status: "delivered" },
    },
  );

  const remoteCreated = await callApi(baseUrl, "/api/grocery-requests", {
    method: "POST",
    cookie: caregiverCookie,
    body: requestBody,
    expectedStatus: 201,
  });
  const remoteRequestId = remoteCreated.payload.data.request._id;
  await callApi(
    baseUrl,
    "/api/grocery-requests/family/" + remoteRequestId + "/review",
    {
      method: "PATCH",
      cookie: familyCookie,
      body: {
        decision: "approve",
        fulfillmentMethod: "family-remote-order",
        approvedBudget: 1500,
      },
    },
  );
  await callApi(
    baseUrl,
    "/api/grocery-requests/family/" + remoteRequestId + "/purchase",
    {
      method: "PATCH",
      cookie: familyCookie,
      body: {
        actualTotal: 1250,
        paymentArrangement: "family-paid-store-directly",
        externalOrderReference: "TEST-ORDER-01",
      },
    },
  );
  await callApi(
    baseUrl,
    "/api/grocery-requests/family/" + remoteRequestId + "/status",
    {
      method: "PATCH",
      cookie: familyCookie,
      body: { status: "out-for-delivery" },
    },
  );
  await callApi(
    baseUrl,
    "/api/grocery-requests/caregiver/" + remoteRequestId + "/status",
    {
      method: "PATCH",
      cookie: caregiverCookie,
      body: { status: "delivered" },
    },
  );

  const cancelledCreated = await callApi(baseUrl, "/api/grocery-requests", {
    method: "POST",
    cookie: caregiverCookie,
    body: requestBody,
    expectedStatus: 201,
  });
  const cancelledRequestId = cancelledCreated.payload.data.request._id;
  await callApi(
    baseUrl,
    "/api/grocery-requests/caregiver/" + cancelledRequestId + "/status",
    {
      method: "PATCH",
      cookie: caregiverCookie,
      body: { status: "cancelled" },
    },
  );

  const localRequest = await GroceryRequest.findById(localRequestId);

  if (
    localRequest.status !== "delivered"
    || localRequest.paymentSettled !== true
    || localRequest.receipt !== null
  ) {
    throw new Error("Local purchase did not preserve delivery, settlement, or optional receipt behavior.");
  }

  const remoteRequest = await GroceryRequest.findById(remoteRequestId);

  if (remoteRequest.status !== "delivered") {
    throw new Error("Family remote-order path did not reach delivered.");
  }

  const submittedNotification = await Notification.findOne({
    recipient: family._id,
    relatedEntityId: localRequestId,
    type: "grocery-request-submitted",
  });
  const approvalNotification = await Notification.findOne({
    recipient: caregiver._id,
    relatedEntityId: localRequestId,
    type: "grocery-request-approved",
  });

  if (!submittedNotification || !approvalNotification) {
    throw new Error("Grocery workflow notifications were not created.");
  }

  console.log("Grocery request and store-workflow smoke test passed.");
}

/**
 * Stops the temporary server and removes all smoke-test records.
 * @returns {Promise<void>}
 * @sideEffects Deletes temporary MongoDB data and disconnects Mongoose.
 */
async function cleanup() {
  if (server) {
    await new Promise((resolve) => {
      server.close(resolve);
    });
  }

  if (elderlyProfile) {
    await GroceryRequest.deleteMany({
      elderlyProfileId: elderlyProfile._id,
    });
    await CareAssignment.deleteMany({
      elderlyProfileId: elderlyProfile._id,
    });
    await ElderlyFamilyLink.deleteMany({
      elderlyProfileId: elderlyProfile._id,
    });
    await ElderlyProfile.deleteOne({
      _id: elderlyProfile._id,
    });
  }

  if (createdUserIds.length > 0) {
    await Notification.deleteMany({
      recipient: {
        $in: createdUserIds,
      },
    });
    await CaregiverProfile.deleteMany({
      userId: {
        $in: createdUserIds,
      },
    });
    await User.deleteMany({
      _id: {
        $in: createdUserIds,
      },
    });
  }

  await mongoose.disconnect();
}

runSmokeTest()
  .catch((error) => {
    console.error("Grocery request smoke test failed:", error);
    process.exitCode = 1;
  })
  .finally(cleanup);
