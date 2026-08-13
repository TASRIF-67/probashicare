import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import app from "../app.js";
import { connectDatabase } from "../config/database.js";
import { env, validateEnvironment } from "../config/env.js";
import { FamilySubscription } from "../models/FamilySubscription.js";
import { Notification } from "../models/Notification.js";
import { SubscriptionPayment } from "../models/SubscriptionPayment.js";
import { SubscriptionPlan } from "../models/SubscriptionPlan.js";
import { User } from "../models/User.js";
import { synchronizeSubscriptionPlans } from "../services/subscriptionPlanService.js";
import { expireStalePrototypePayments } from "../services/prototypePaymentService.js";

const marker = "subscription-smoke-" + Date.now();
const password = "SubscriptionSmokePassword2026";
let server;
let baseUrl;
let createdUserIds = [];

/**
 * Calls one local authenticated API endpoint and verifies its status.
 * @param {string} path - API path after /api.
 * @param {{method?: string, body?: object, cookie?: string, expectedStatus?: number}} [options] - Request configuration.
 * @returns {Promise<{payload: object, cookie: string}>} Parsed response and session cookie.
 * @sideEffects Sends a local HTTP request.
 */
async function callApi(
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
      method +
        " " +
        path +
        " returned " +
        response.status +
        ": " +
        JSON.stringify(payload),
    );
  }

  return {
    payload,
    cookie:
      response.headers.get("set-cookie")?.split(";")[0] || cookie || "",
  };
}

/**
 * Creates a verified smoke-test account.
 * @param {"family"|"caregiver"|"admin"} role - User role.
 * @param {string} suffix - Unique email suffix.
 * @returns {Promise<object>} Created User document.
 * @sideEffects Hashes a password and creates a User document.
 */
async function createUser(role, suffix) {
  const user = await User.create({
    name: role + " subscription smoke",
    email: marker + "-" + suffix + "@example.test",
    password: await bcrypt.hash(password, 12),
    role,
    isVerified: true,
  });
  createdUserIds.push(user._id);
  return user;
}

/**
 * Creates an authenticated session cookie.
 * @param {object} user - Smoke-test user.
 * @returns {Promise<string>} Session cookie.
 * @sideEffects Calls the local login API.
 */
async function login(user) {
  const result = await callApi("/auth/login", {
    method: "POST",
    body: { email: user.email, password },
  });
  return result.cookie;
}

/**
 * Runs authenticated subscription, ownership, trial, payment, and reminder checks.
 * @returns {Promise<void>}
 * @sideEffects Connects MongoDB, starts a local server, and creates temporary records.
 */
async function run() {
  validateEnvironment();

  if (!env.prototypePaymentsEnabled) {
    throw new Error(
      "Set PROTOTYPE_PAYMENTS_ENABLED=true in backend/.env for this development smoke test.",
    );
  }

  await connectDatabase();
  await synchronizeSubscriptionPlans();
  await Promise.all([
    FamilySubscription.syncIndexes(),
    SubscriptionPayment.syncIndexes(),
    Notification.syncIndexes(),
  ]);
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = "http://127.0.0.1:" + server.address().port + "/api";

  const familyA = await createUser("family", "a");
  const familyB = await createUser("family", "b");
  const caregiver = await createUser("caregiver", "caregiver");
  const admin = await createUser("admin", "admin");
  const familyACookie = await login(familyA);
  const familyBCookie = await login(familyB);
  const caregiverCookie = await login(caregiver);
  const adminCookie = await login(admin);

  const plans = await callApi("/subscriptions/plans", {
    cookie: familyACookie,
  });
  if (plans.payload.data.plans.length !== 3) {
    throw new Error("Expected three active subscription plans.");
  }

  await callApi("/subscriptions/trial/activate", {
    method: "POST",
    cookie: caregiverCookie,
    expectedStatus: 403,
  });
  const trial = await callApi("/subscriptions/trial/activate", {
    method: "POST",
    cookie: familyACookie,
    expectedStatus: 201,
  });
  if (!trial.payload.data.access.isPremium) {
    throw new Error("Trial did not provide Premium access.");
  }
  await callApi("/subscriptions/trial/activate", {
    method: "POST",
    cookie: familyACookie,
    expectedStatus: 409,
  });

  const pending = await callApi("/subscriptions/purchase", {
    method: "POST",
    cookie: familyACookie,
    expectedStatus: 201,
    body: {
      planCode: "day_pass",
      paymentMethod: "test_wallet",
      price: 1,
      durationValue: 999,
    },
  });
  const payment = pending.payload.data.payment;
  if (payment.amount !== 199 || payment.planSnapshot.durationValue !== 24) {
    throw new Error("Backend-authoritative plan values were not preserved.");
  }

  await callApi(
    "/subscriptions/payments/" + payment._id + "/simulate-success",
    {
      method: "POST",
      cookie: familyBCookie,
      expectedStatus: 404,
    },
  );
  const completed = await callApi(
    "/subscriptions/payments/" + payment._id + "/simulate-success",
    { method: "POST", cookie: familyACookie },
  );
  const firstExpiry =
    completed.payload.data.subscription.currentPeriodEndsAt;
  const repeated = await callApi(
    "/subscriptions/payments/" + payment._id + "/simulate-success",
    { method: "POST", cookie: familyACookie },
  );
  if (
    repeated.payload.data.subscription.currentPeriodEndsAt !== firstExpiry ||
    !repeated.payload.data.alreadyCompleted
  ) {
    throw new Error("Repeated confirmation extended access twice.");
  }

  const failedPending = await callApi("/subscriptions/purchase", {
    method: "POST",
    cookie: familyBCookie,
    expectedStatus: 201,
    body: { planCode: "monthly", paymentMethod: "test_card" },
  });
  await callApi(
    "/subscriptions/payments/" +
      failedPending.payload.data.payment._id +
      "/simulate-failure",
    { method: "POST", cookie: familyBCookie },
  );
  const familyBState = await callApi("/subscriptions/me", {
    cookie: familyBCookie,
  });
  if (familyBState.payload.data.access.isPremium) {
    throw new Error("Failed payment incorrectly activated access.");
  }

  const abandonedPending = await callApi("/subscriptions/purchase", {
    method: "POST",
    cookie: familyBCookie,
    expectedStatus: 201,
    body: { planCode: "day_pass", paymentMethod: "test_wallet" },
  });
  const futureClock = new Date(Date.now() + 20 * 60 * 1000);
  await expireStalePrototypePayments({
    familyUserId: familyB._id,
    now: futureClock,
    maxAgeMinutes: 15,
  });
  const familyBHistory = await callApi("/subscriptions/payments", {
    cookie: familyBCookie,
  });
  const expiredPayment = familyBHistory.payload.data.payments.find((entry) => {
    return entry._id === abandonedPending.payload.data.payment._id;
  });
  if (
    !expiredPayment ||
    expiredPayment.status !== "cancelled" ||
    !expiredPayment.failureReason.includes("expired")
  ) {
    throw new Error("Abandoned pending payment did not expire safely.");
  }

  const history = await callApi("/subscriptions/payments", {
    cookie: familyACookie,
  });
  if (history.payload.data.payments.length !== 1) {
    throw new Error("Family payment history leaked or omitted records.");
  }

await callApi("/admin/subscriptions/analytics", {
    cookie: familyACookie,
    expectedStatus: 403,
  });
  const adminAnalytics = await callApi("/admin/subscriptions/analytics", {
    cookie: adminCookie,
  });
  if (
    adminAnalytics.payload.data.totals.completed < 1 ||
    adminAnalytics.payload.data.totals.completedRevenue < 199
  ) {
    throw new Error("Admin analytics omitted completed simulated revenue.");
  }
  const adminPayments = await callApi("/admin/subscriptions/payments", {
    cookie: adminCookie,
  });
  const visiblePayment = adminPayments.payload.data.payments.find((entry) => {
    return entry._id === payment._id;
  });
  if (!visiblePayment || !visiblePayment.confirmationReference) {
    throw new Error("Admin transaction history omitted the completed payment.");
  }

  console.log("Authenticated subscription and Admin analytics smoke test passed.");
}

/**
 * Removes all records created by this smoke test.
 * @returns {Promise<void>}
 * @sideEffects Deletes temporary documents, closes server, and disconnects MongoDB.
 */
async function cleanup() {
  if (createdUserIds.length) {
    await Notification.deleteMany({ recipient: { $in: createdUserIds } });
    await SubscriptionPayment.deleteMany({ family: { $in: createdUserIds } });
    await FamilySubscription.deleteMany({ family: { $in: createdUserIds } });
    await User.deleteMany({ _id: { $in: createdUserIds } });
  }

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await mongoose.disconnect();
}

run()
  .catch((error) => {
    console.error("Authenticated subscription API smoke test failed:", error.message);
    process.exitCode = 1;
  })
  .finally(cleanup);
