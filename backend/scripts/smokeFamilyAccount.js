import assert from "node:assert/strict";

// The marker makes test emails unique and helps identify fixture data.
const marker = "family-account-smoke-" + Date.now();
const password = "FamilyAccountSmokePassword2026";
const updatedPassword = password;
const createdUserIds = [];

let app;
let bcrypt;
let connectDatabase;
let EmailVerificationToken;
let mongoose;
let PasswordResetToken;
let User;
let server = null;
let baseUrl = "";

/**
 * Forces safe local email delivery and then loads project modules.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<void>} Resolves after all required modules are assigned.
 * @sideEffects Loads environment configuration and application modules.
 */
async function loadDependencies() {
  // ESM imports are cached after loading. These variables must be set before
  // importing app.js so the smoke test never sends a real email.
  process.env.NODE_ENV = "development";
  process.env.SMTP_HOST = "";
  process.env.SMTP_USER = "";
  process.env.SMTP_PASS = "";

  // Promise.all starts independent dynamic imports together and waits for all
  // of them. Dynamic imports are required here because environment setup must
  // happen first.
  const modules = await Promise.all([
    import("bcryptjs"),
    import("mongoose"),
    import("../app.js"),
    import("../config/database.js"),
    import("../models/EmailVerificationToken.js"),
    import("../models/PasswordResetToken.js"),
    import("../models/User.js"),
  ]);

  bcrypt = modules[0].default;
  mongoose = modules[1].default;
  app = modules[2].default;
  connectDatabase = modules[3].connectDatabase;
  EmailVerificationToken =
    modules[4].EmailVerificationToken;
  PasswordResetToken =
    modules[5].PasswordResetToken;
  User = modules[6].User;
}

/**
 * Starts the Express application on a random free local port.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<void>} Resolves after the listener is ready.
 * @sideEffects Opens one temporary local HTTP server.
 */
async function startServer() {
  await new Promise(
    /**
     * Connects Promise completion to temporary server events.
     * @param {Function} resolve - Completes the Promise after listening.
     * @param {Function} reject - Rejects the Promise after a server error.
     * @returns {void}
     * @sideEffects Opens a temporary local listener.
     */
    function waitForServer(resolve, reject) {
      server = app.listen(0, "127.0.0.1");
      server.once("listening", resolve);
      server.once("error", reject);
    },
  );

  const address = server.address();
  baseUrl =
    "http://127.0.0.1:" +
    address.port +
    "/api";
}

/**
 * Stops the temporary local HTTP server.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<void>} Resolves after the listener closes.
 * @sideEffects Closes the local server.
 */
async function stopServer() {
  if (!server) {
    return;
  }

  await new Promise(
    /**
     * Connects Promise completion to temporary server shutdown.
     * @param {Function} resolve - Completes after close.
     * @param {Function} reject - Rejects after close failure.
     * @returns {void}
     * @sideEffects Requests server shutdown.
     */
    function waitForClose(resolve, reject) {
      /**
       * Completes the Promise used to await server shutdown.
       * @param {Error|undefined} error - Optional close error.
       * @returns {void}
       * @sideEffects Resolves or rejects the surrounding Promise.
       */
      function finishClose(error) {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      }

      server.close(finishClose);
    },
  );

  server = null;
}

/**
 * Reads only the cookie name/value from a Set-Cookie response header.
 * @param {Response} response - Fetch response.
 * @param {string} fallbackCookie - Existing cookie when none is replaced.
 * @returns {{cookie: string, setCookie: string}} Cookie values for assertions.
 * @sideEffects None.
 */
function readResponseCookie(response, fallbackCookie) {
  const setCookie =
    response.headers.get("set-cookie") || "";

  if (!setCookie) {
    return {
      cookie: fallbackCookie,
      setCookie,
    };
  }

  // split divides the header at semicolons. The first item is the only part
  // sent back through the later Cookie request header.
  const cookieParts = setCookie.split(";");

  return {
    cookie: cookieParts[0],
    setCookie,
  };
}

/**
 * Sends one request to the temporary authenticated API.
 * @param {string} path - Path beginning after /api.
 * @param {object} [options={}] - Request settings.
 * @param {string} [options.method="GET"] - HTTP method.
 * @param {object} [options.body] - Optional JSON body.
 * @param {string} [options.cookie=""] - Optional session cookie.
 * @param {number} [options.expectedStatus=200] - Required HTTP status.
 * @returns {Promise<{payload: object, cookie: string, setCookie: string}>} API result.
 * @sideEffects Sends one local HTTP request.
 */
async function callApi(path, options = {}) {
  const method = options.method || "GET";
  const body = options.body;
  const cookie = options.cookie || "";
  const expectedStatus =
    options.expectedStatus === undefined
      ? 200
      : options.expectedStatus;
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
    // JSON.stringify converts the object into the JSON text expected by
    // express.json on the server.
    requestOptions.body = JSON.stringify(body);
  }

  const response = await fetch(
    baseUrl + path,
    requestOptions,
  );
  // response.json asynchronously parses the response body text.
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

  const responseCookie = readResponseCookie(
    response,
    cookie,
  );

  return {
    payload,
    cookie: responseCookie.cookie,
    setCookie: responseCookie.setCookie,
  };
}

/**
 * Creates one verified Family fixture account.
 * @param {string} suffix - Unique part of the test email.
 * @returns {Promise<object>} Created Mongoose User document.
 * @sideEffects Hashes a password and inserts one User.
 */
async function createFamily(suffix) {
  const passwordHash = await bcrypt.hash(
    password,
    12,
  );
  const user = await User.create({
    name: "Family Account Smoke Owner",
    email:
      marker +
      "-" +
      suffix +
      "@example.test",
    password: passwordHash,
    role: "family",
    isVerified: true,
  });

  // push appends this exact ID for narrow cleanup in the final block.
  createdUserIds.push(user._id);
  return user;
}

/**
 * Signs a fixture Family user in through the real login endpoint.
 * @param {object} user - User document containing the login email.
 * @param {number} [expectedStatus=200] - Required login response status.
 * @returns {Promise<{payload: object, cookie: string, setCookie: string}>} Login result.
 * @sideEffects Sends a local authentication request.
 */
async function login(user, expectedStatus = 200) {
  return callApi("/auth/login", {
    method: "POST",
    expectedStatus,
    body: {
      email: user.email,
      password: updatedPassword,
    },
  });
}

/**
 * Finds the first HTTP URL printed by development email delivery.
 * @param {string[]} messages - Captured console messages.
 * @returns {string} Verification URL.
 * @sideEffects Throws if no URL exists.
 */
function readVerificationUrl(messages) {
  for (const message of messages) {
    // indexOf returns -1 when the requested text is absent.
    const urlStart = message.indexOf("http");

    if (urlStart >= 0) {
      // slice copies the URL from its starting position to the end.
      return message.slice(urlStart).trim();
    }
  }

  throw new Error(
    "The development verification link was not printed.",
  );
}

/**
 * Exercises the complete Family owner identity and re-verification flow.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<void>} Resolves after all authenticated assertions pass.
 * @sideEffects Creates users/tokens and calls the local API.
 */
async function runSmokeTest() {
  await loadDependencies();
  await connectDatabase();
  await startServer();

  const owner = await createFamily("owner");
  const duplicateOwner = await createFamily("duplicate");
  const originalEmail = owner.email;
  const newEmail =
    marker +
    "-updated@example.test";

  const loginResult = await login(owner);
  const originalCookie = loginResult.cookie;

  assert.match(originalCookie, /^session=/);

  const nameUpdate = await callApi(
    "/auth/account",
    {
      method: "PATCH",
      cookie: originalCookie,
      body: {
        name: "Updated Family Owner",
        email: originalEmail,
      },
    },
  );

  assert.equal(
    nameUpdate.payload.data.requiresEmailVerification,
    false,
  );
  assert.equal(
    nameUpdate.payload.data.user.name,
    "Updated Family Owner",
  );

  // A name-only change keeps the existing verified session usable.
  const currentUser = await callApi(
    "/auth/me",
    {
      cookie: originalCookie,
    },
  );
  assert.equal(
    currentUser.payload.data.user.name,
    "Updated Family Owner",
  );

  await callApi("/auth/account", {
    method: "PATCH",
    cookie: originalCookie,
    expectedStatus: 422,
    body: {
      name: "Updated Family Owner",
      email: newEmail,
      currentPassword: "wrong-current-password",
    },
  });

  await callApi("/auth/account", {
    method: "PATCH",
    cookie: originalCookie,
    expectedStatus: 409,
    body: {
      name: "Updated Family Owner",
      email: duplicateOwner.email,
      currentPassword: password,
    },
  });

  const capturedMessages = [];
  const originalConsoleLog = console.log;

  /**
   * Captures development-only verification output instead of printing its
   * one-time link to the test terminal.
   * @param {...unknown} values - Values supplied to console.log.
   * @returns {void}
   * @sideEffects Appends one combined message to capturedMessages.
   */
  function captureConsoleLog(...values) {
    const textValues = [];

    // for...of reads each supplied value. String converts it to text.
    for (const value of values) {
      textValues.push(String(value));
    }

    // join combines the text values with one space between them.
    capturedMessages.push(textValues.join(" "));
  }

  let emailUpdate;

  try {
    console.log = captureConsoleLog;

    emailUpdate = await callApi(
      "/auth/account",
      {
        method: "PATCH",
        cookie: originalCookie,
        body: {
          name: "Updated Family Owner",
          email: newEmail,
          currentPassword: password,
        },
      },
    );
  } finally {
    // finally always restores console.log, even when the request fails.
    console.log = originalConsoleLog;
  }

  assert.equal(
    emailUpdate.payload.data.requiresEmailVerification,
    true,
  );
  assert.equal(
    emailUpdate.payload.data.email,
    newEmail,
  );
  assert.match(
    emailUpdate.setCookie,
    /session=/,
  );

  const storedUnverifiedUser =
    await User.findById(owner._id);
  assert.equal(
    storedUnverifiedUser.email,
    newEmail,
  );
  assert.equal(
    storedUnverifiedUser.isVerified,
    false,
  );

  const verificationUrl =
    readVerificationUrl(capturedMessages);
  const parsedUrl = new URL(verificationUrl);
  const rawToken =
    parsedUrl.searchParams.get("token");

  assert.ok(rawToken);

  const tokenRecord =
    await EmailVerificationToken.findOne({
      userId: owner._id,
    });
  assert.ok(tokenRecord);
  assert.notEqual(
    tokenRecord.tokenHash,
    rawToken,
  );

  // The old signed JWT still exists in the browser, but requireAuth reloads the
  // current User document and rejects it because isVerified is now false.
  await callApi("/auth/me", {
    cookie: originalCookie,
    expectedStatus: 401,
  });

  await callApi(
    "/auth/verify-email?token=" +
      encodeURIComponent(rawToken),
  );

  const verifiedUser =
    await User.findById(owner._id);
  assert.equal(
    verifiedUser.isVerified,
    true,
  );

  // Reopening the already-used link is deliberately idempotent.
  const repeatedVerification = await callApi(
    "/auth/verify-email?token=" +
      encodeURIComponent(rawToken),
  );
  assert.match(
    repeatedVerification.payload.data.message,
    /already verified/i,
  );

  const oldEmailLoginUser = {
    email: originalEmail,
  };
  await login(oldEmailLoginUser, 401);

  const newEmailLoginUser = {
    email: newEmail,
  };
  const newLogin = await login(newEmailLoginUser);

  assert.equal(
    newLogin.payload.data.user.email,
    newEmail,
  );
  assert.equal(
    newLogin.payload.data.user.isVerified,
    true,
  );
}

/**
 * Deletes only records created by this smoke test.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<void>} Resolves after fixture cleanup.
 * @sideEffects Deletes tracked token/User documents from MongoDB.
 */
async function cleanup() {
  if (
    !mongoose ||
    mongoose.connection.readyState === 0
  ) {
    return;
  }

  if (createdUserIds.length > 0) {
    const fixtureFilter = {
      // $in matches documents whose user ID appears in the tracked array.
      $in: createdUserIds,
    };

    await Promise.all([
      EmailVerificationToken.deleteMany({
        userId: fixtureFilter,
      }),
      PasswordResetToken.deleteMany({
        userId: fixtureFilter,
      }),
      User.deleteMany({
        _id: fixtureFilter,
      }),
    ]);
  }
}

/**
 * Runs the smoke lifecycle and always closes resources.
 * @param {void} _unused - This function accepts no arguments.
 * @returns {Promise<void>} Resolves when test and cleanup finish.
 * @sideEffects Opens/closes MongoDB and HTTP resources.
 */
async function startSmokeTest() {
  try {
    await runSmokeTest();
    console.log(
      "Family account and email re-verification smoke test passed.",
    );
  } finally {
    await stopServer();
    await cleanup();

    if (
      mongoose &&
      mongoose.connection.readyState !== 0
    ) {
      await mongoose.disconnect();
    }
  }
}

/**
 * Reports an unhandled smoke failure.
 * @param {Error} error - Test or cleanup failure.
 * @returns {void}
 * @sideEffects Writes to stderr and sets a failing process exit code.
 */
function handleSmokeFailure(error) {
  console.error(
    "Family account smoke test failed:",
    error,
  );
  process.exitCode = 1;
}

// catch observes a rejected Promise returned by the async smoke lifecycle.
startSmokeTest().catch(handleSmokeFailure);