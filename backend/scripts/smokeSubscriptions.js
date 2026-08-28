import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import app from "../app.js";
import { connectDatabase } from "../config/database.js";
import { env, validateEnvironment } from "../config/env.js";
import { FamilySubscription } from "../models/FamilySubscription.js";
import { Notification } from "../models/Notification.js";
import { SubscriptionPayment } from "../models/SubscriptionPayment.js";
import { User } from "../models/User.js";
import { expireStalePrototypePayments } from "../services/prototypePaymentService.js";
import { synchronizeSubscriptionPlans } from "../services/subscriptionPlanService.js";

const marker = "subscription-smoke-" + Date.now();
const password = "SubscriptionSmokePassword2026";
let server = null;
let baseUrl = "";
const createdUserIds = [];

/**
 * Extracts the session cookie from a response without retaining cookie options.
 * @param {Response} response - Fetch API response.
 * @param {string} fallbackCookie - Existing cookie when no new cookie is sent.
 * @returns {string} First Set-Cookie value or the supplied fallback.
 * @sideEffects None.
 */
function readSessionCookie(response, fallbackCookie) {
  const setCookieHeader = response.headers.get("set-cookie");

  if (!setCookieHeader) {
    return fallbackCookie;
  }

  // `split` divides the header at semicolons. Index zero is the name/value
  // required in the Cookie request header.
  const cookieParts = setCookieHeader.split(";");
  return cookieParts[0];
}

/**
 * Calls one local API endpoint and verifies its response status.
 * @param {string} path - API path after /api.
 * @param {object} [options={}] - Request configuration.
 * @param {string} [options.method="GET"] - HTTP method.
 * @param {object} [options.body] - Optional JSON body.
 * @param {string} [options.cookie=""] - Optional session cookie.
 * @param {number} [options.expectedStatus=200] - Required response status.
 * @returns {Promise<{payload: object, cookie: string}>} Parsed response data.
 * @sideEffects Sends a local HTTP request.
 */
async function callApi(path, options = {}) {
  const method = options.method || "GET";
  const body = options.body;
  const cookie = options.cookie || "";
  const expectedStatus = options.expectedStatus || 200;
  const headers = {};

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  if (cookie) {
    headers.Cookie = cookie;
  }

  const requestOptions = {
    method,
    headers,
  };

  if (body) {
    // `JSON.stringify` converts a JavaScript object into HTTP JSON text.
    requestOptions.body = JSON.stringify(body);
  }

  const response = await fetch(baseUrl + path, requestOptions);
  // `response.json` parses response JSON text into a JavaScript object.
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
    cookie: readSessionCookie(response, cookie),
  };
}

/**
 * Creates one verified smoke-test account.
 * @param {"family"|"caregiver"|"admin"} role - User role.
 * @param {string} suffix - Unique email suffix.
 * @returns {Promise<object>} Created Mongoose User document.
 * @sideEffects Hashes a password, creates a user, and tracks its ID.
 */
async function createUser(role, suffix) {
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({
    name: role + " subscription smoke",
    email: marker + "-" + suffix + "@example.test",
    password: passwordHash,
    role,
    isVerified: true,
  });

  // `push` appends one value to the end of this cleanup array.
  createdUserIds.push(user._id);
  return user;
}

/**
 * Creates an authenticated local session for a smoke-test user.
 * @param {object} user - Created User document.
 * @returns {Promise<string>} Session cookie.
 * @sideEffects Sends a login request.
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
 * Verifies catalog access and role protection.
 * @param {string} familyCookie - Authenticated Family cookie.
 * @param {string} caregiverCookie - Authenticated Caregiver cookie.
 * @returns {Promise<void>}
 * @sideEffects Sends authenticated plan/trial requests.
 */
async function verifyCatalogAndRoleProtection(familyCookie, caregiverCookie) {
  const plansResult = await callApi("/subscriptions/plans", {
    cookie: familyCookie,
  });
  const plans = plansResult.payload.data.plans;

  if (plans.length !== 3) {
    throw new Error("Expected three active subscription plans.");
  }

  await callApi("/subscriptions/trial/activate", {
    method: "POST",
    cookie: caregiverCookie,
    expectedStatus: 403,
  });
}

/**
 * Verifies one-time trial activation and duplicate prevention.
 * @param {string} familyCookie - Authenticated Family cookie.
 * @returns {Promise<void>}
 * @sideEffects Activates a trial and sends a duplicate attempt.
 */
async function verifyTrialWorkflow(familyCookie) {
  const trial = await callApi("/subscriptions/trial/activate", {
    method: "POST",
    cookie: familyCookie,
    expectedStatus: 201,
  });

  if (!trial.payload.data.access.isPremium) {
    throw new Error("Trial did not provide Premium access.");
  }

  await callApi("/subscriptions/trial/activate", {
    method: "POST",
    cookie: familyCookie,
    expectedStatus: 409,
  });
}

/**
 * Verifies authoritative prices, ownership, idempotency, and method separation.
 * @param {string} ownerCookie - Paying Family cookie.
 * @param {string} otherFamilyCookie - Different Family cookie.
 * @returns {Promise<object>} Successfully completed payment.
 * @sideEffects Creates and settles one prototype payment.
 */
async function verifySuccessfulPaymentWorkflow(ownerCookie, otherFamilyCookie) {
  // The prototype route must not accept Stripe. Stripe requires a signed
  // provider webhook through its separate checkout endpoint.
  await callApi("/subscriptions/purchase", {
    method: "POST",
    cookie: ownerCookie,
    expectedStatus: 422,
    body: {
      planCode: "monthly",
      paymentMethod: "stripe_checkout",
    },
  });

  const pendingResult = await callApi("/subscriptions/purchase", {
    method: "POST",
    cookie: ownerCookie,
    expectedStatus: 201,
    body: {
      planCode: "day_pass",
      paymentMethod: "test_wallet",
      // These untrusted client values must be ignored by the backend.
      price: 1,
      durationValue: 999,
    },
  });
  const payment = pendingResult.payload.data.payment;

  if (payment.amount !== 199 || payment.planSnapshot.durationValue !== 24) {
    throw new Error("Backend-authoritative plan values were not preserved.");
  }

  // Another Family receives a concealed 404 instead of learning that the
  // payment exists.
  await callApi(
    "/subscriptions/payments/" + payment._id + "/simulate-success",
    {
      method: "POST",
      cookie: otherFamilyCookie,
      expectedStatus: 404,
    },
  );

  const completedResult = await callApi(
    "/subscriptions/payments/" + payment._id + "/simulate-success",
    {
      method: "POST",
      cookie: ownerCookie,
    },
  );
  const firstExpiry =
    completedResult.payload.data.subscription.currentPeriodEndsAt;

  const repeatedResult = await callApi(
    "/subscriptions/payments/" + payment._id + "/simulate-success",
    {
      method: "POST",
      cookie: ownerCookie,
    },
  );
  const repeatedData = repeatedResult.payload.data;
  const repeatedExpiry = repeatedData.subscription.currentPeriodEndsAt;

  if (repeatedExpiry !== firstExpiry || !repeatedData.alreadyCompleted) {
    throw new Error("Repeated confirmation extended access twice.");
  }

  return payment;
}

/**
 * Verifies failed and abandoned payments never activate Premium access.
 * @param {object} family - Family User document.
 * @param {string} familyCookie - Authenticated Family cookie.
 * @returns {Promise<void>}
 * @sideEffects Creates, fails, and expires prototype payments.
 */
async function verifyUnsuccessfulPaymentWorkflow(family, familyCookie) {
  const failedPending = await callApi("/subscriptions/purchase", {
    method: "POST",
    cookie: familyCookie,
    expectedStatus: 201,
    body: {
      planCode: "monthly",
      paymentMethod: "test_card",
    },
  });
  const failedPaymentId = failedPending.payload.data.payment._id;

  await callApi(
    "/subscriptions/payments/" + failedPaymentId + "/simulate-failure",
    {
      method: "POST",
      cookie: familyCookie,
    },
  );

  const familyState = await callApi("/subscriptions/me", {
    cookie: familyCookie,
  });

  if (familyState.payload.data.access.isPremium) {
    throw new Error("Failed payment incorrectly activated access.");
  }

  const abandonedPending = await callApi("/subscriptions/purchase", {
    method: "POST",
    cookie: familyCookie,
    expectedStatus: 201,
    body: {
      planCode: "day_pass",
      paymentMethod: "test_wallet",
    },
  });
  const abandonedPaymentId = abandonedPending.payload.data.payment._id;
  const futureClock = new Date(Date.now() + 20 * 60 * 1000);

  await expireStalePrototypePayments({
    familyUserId: family._id,
    now: futureClock,
    maxAgeMinutes: 15,
  });

  const history = await callApi("/subscriptions/payments", {
    cookie: familyCookie,
  });

  // `find` returns the first element whose callback returns true.
  const expiredPayment = history.payload.data.payments.find(
    /**
     * Matches the payment created for stale-payment expiry.
     * @param {object} entry - One returned payment.
     * @returns {boolean} True for the abandoned fixture.
     * @sideEffects None.
     */
    function findAbandonedPayment(entry) {
      return entry._id === abandonedPaymentId;
    },
  );

  if (!expiredPayment) {
    throw new Error("Abandoned payment was missing from history.");
  }

  if (
    expiredPayment.status !== "cancelled" ||
    !expiredPayment.failureReason.includes("expired")
  ) {
    throw new Error("Abandoned pending payment did not expire safely.");
  }
}

/**
 * Verifies Family history isolation and Admin reporting.
 * @param {object} completedPayment - Payment created by Family A.
 * @param {string} ownerCookie - Family A cookie.
 * @param {string} familyCookie - Non-admin Family cookie.
 * @param {string} adminCookie - Admin cookie.
 * @returns {Promise<void>}
 * @sideEffects Reads Family and Admin reporting endpoints.
 */
async function verifyHistoryAndAdminReporting(
  completedPayment,
  ownerCookie,
  familyCookie,
  adminCookie,
) {
  const history = await callApi("/subscriptions/payments", {
    cookie: ownerCookie,
  });

  if (history.payload.data.payments.length !== 1) {
    throw new Error("Family payment history leaked or omitted records.");
  }

  await callApi("/admin/subscriptions/analytics", {
    cookie: familyCookie,
    expectedStatus: 403,
  });

  const analyticsResult = await callApi("/admin/subscriptions/analytics", {
    cookie: adminCookie,
  });
  const totals = analyticsResult.payload.data.totals;

  if (totals.completed < 1 || totals.completedRevenue < 199) {
    throw new Error("Admin analytics omitted completed development revenue.");
  }

  const paymentsResult = await callApi("/admin/subscriptions/payments", {
    cookie: adminCookie,
  });

  const visiblePayment = paymentsResult.payload.data.payments.find(
    /**
     * Matches the completed payment in the Admin response.
     * @param {object} entry - One Admin-visible payment.
     * @returns {boolean} True for the completed fixture.
     * @sideEffects None.
     */
    function findCompletedPayment(entry) {
      return entry._id === completedPayment._id;
    },
  );

  if (!visiblePayment || !visiblePayment.confirmationReference) {
    throw new Error("Admin transaction history omitted the completed payment.");
  }
}

/**
 * Runs authenticated subscription, ownership, payment, and Admin checks.
 * @returns {Promise<void>}
 * @sideEffects Connects MongoDB, starts a server, and creates temporary data.
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

  // These index operations are independent, so `Promise.all` starts them
  // together and waits for all three to succeed.
  await Promise.all([
    FamilySubscription.syncIndexes(),
    SubscriptionPayment.syncIndexes(),
    Notification.syncIndexes(),
  ]);

  server = app.listen(0);

  await new Promise(
    /**
     * Resolves after the random-port server starts listening.
     * @param {() => void} resolve - Promise completion function.
     * @returns {void}
     * @sideEffects Registers one server event listener.
     */
    function waitForServer(resolve) {
      server.once("listening", resolve);
    },
  );

  const address = server.address();
  baseUrl = "http://127.0.0.1:" + address.port + "/api";

  const familyA = await createUser("family", "a");
  const familyB = await createUser("family", "b");
  const caregiver = await createUser("caregiver", "caregiver");
  const admin = await createUser("admin", "admin");

  const familyACookie = await login(familyA);
  const familyBCookie = await login(familyB);
  const caregiverCookie = await login(caregiver);
  const adminCookie = await login(admin);

  await verifyCatalogAndRoleProtection(familyACookie, caregiverCookie);
  await verifyTrialWorkflow(familyACookie);

  const completedPayment = await verifySuccessfulPaymentWorkflow(
    familyACookie,
    familyBCookie,
  );

  await verifyUnsuccessfulPaymentWorkflow(familyB, familyBCookie);

  await verifyHistoryAndAdminReporting(
    completedPayment,
    familyACookie,
    familyBCookie,
    adminCookie,
  );

  console.log(
    "Authenticated subscription and Admin analytics smoke test passed.",
  );
}

/**
 * Closes the local HTTP server if it was started.
 * @returns {Promise<void>} Resolves when the server closes.
 * @sideEffects Stops the smoke-test HTTP server.
 */
async function closeServer() {
  if (!server) {
    return;
  }

  await new Promise(
    /**
     * Resolves after the local smoke-test server closes.
     * @param {() => void} resolve - Promise completion function.
     * @returns {void}
     * @sideEffects Starts server shutdown.
     */
    function waitForServerClose(resolve) {
      server.close(resolve);
    },
  );
}

/**
 * Removes every record created by this smoke test.
 * @returns {Promise<void>}
 * @sideEffects Deletes fixtures, closes the server, and disconnects MongoDB.
 */
async function cleanup() {
  if (createdUserIds.length > 0) {
    // MongoDB's `$in` operator matches any ID contained in the cleanup array.
    const userFilter = {
      $in: createdUserIds,
    };

    await Notification.deleteMany({
      recipient: userFilter,
    });
    await SubscriptionPayment.deleteMany({
      family: userFilter,
    });
    await FamilySubscription.deleteMany({
      family: userFilter,
    });
    await User.deleteMany({
      _id: userFilter,
    });
  }

  await closeServer();
  await mongoose.disconnect();
}

/**
 * Reports a failed smoke test and assigns a non-zero process result.
 * @param {Error} error - Test or infrastructure failure.
 * @returns {void}
 * @sideEffects Writes to stderr and changes process.exitCode.
 */
function handleFailure(error) {
  console.error(
    "Authenticated subscription API smoke test failed:",
    error.message,
  );
  process.exitCode = 1;
}

// `catch` handles test rejection. `finally` always removes temporary data.
run().catch(handleFailure).finally(cleanup);
