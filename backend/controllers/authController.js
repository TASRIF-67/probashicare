import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { CaregiverProfile } from "../models/CaregiverProfile.js";
import { EmailVerificationToken } from "../models/EmailVerificationToken.js";
import { PasswordResetToken } from "../models/PasswordResetToken.js";
import { User } from "../models/User.js";
import {
  familyHasActiveElderlyProfiles,
} from "../services/elderlyProfileAccessService.js";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "../services/emailService.js";
import {
  verifyGoogleCredential,
} from "../services/googleAuthService.js";
import { ApiError } from "../utils/ApiError.js";
import {
  createPasswordResetToken,
  createSessionToken,
  createVerificationToken,
  hashPasswordResetToken,
  hashVerificationToken,
} from "../utils/authTokens.js";
import { toPublicUser } from "../utils/userResponse.js";

const PASSWORD_HASH_ROUNDS = 12;
const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MILLISECONDS_PER_SECOND = 1000;
const VERIFICATION_TOKEN_HOURS = 24;
const PASSWORD_RESET_TOKEN_HOURS = 1;
const SESSION_DAYS = 7;

let secureCookie = false;
let cookieSameSite = "lax";

if (env.nodeEnv === "production") {
  secureCookie = true;
  cookieSameSite = "none";
}

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: secureCookie,
  sameSite: cookieSameSite,
  maxAge:
    SESSION_DAYS *
    HOURS_PER_DAY *
    MINUTES_PER_HOUR *
    SECONDS_PER_MINUTE *
    MILLISECONDS_PER_SECOND,
};

const SESSION_COOKIE_CLEAR_OPTIONS = {
  httpOnly: true,
  secure: secureCookie,
  sameSite: cookieSameSite,
};

/**
 * Converts a number of hours into milliseconds for token expiry.
 * @param {number} hours - Whole or decimal hour count.
 * @returns {number} Equivalent milliseconds.
 * @sideEffects None.
 */
function hoursToMilliseconds(hours) {
  return (
    hours *
    MINUTES_PER_HOUR *
    SECONDS_PER_MINUTE *
    MILLISECONDS_PER_SECOND
  );
}

/**
 * Chooses the frontend verification mode for an account role.
 * @param {string} role - Stored User role.
 * @returns {"caregiver"|"family"} Verification-page presentation mode.
 * @sideEffects None.
 */
function getVerificationMode(role) {
  if (role === "caregiver") {
    return "caregiver";
  }

  return "family";
}

/**
 * Persists a fresh verification-token hash and emails its raw value.
 * @param {{_id: import("mongoose").Types.ObjectId, email: string, name: string, role: string}} user - Unverified user.
 * @returns {Promise<{messageId: string}>} Delivery result.
 * @sideEffects Replaces verification records and sends/prints one email link.
 */
async function issueVerificationEmail(user) {
  // Execution sequence:
  // 1. Generate a raw one-time token and exact expiry.
  // 2. Delete old tokens and store only the new token hash.
  // 3. Email the raw-token URL; remove the hash record if delivery fails.
  const token = createVerificationToken();
  const expiresAt = new Date(
    Date.now() +
      hoursToMilliseconds(VERIFICATION_TOKEN_HOURS),
  );

  // A new request invalidates every older link for this account.
  await EmailVerificationToken.deleteMany({
    userId: user._id,
  });

  await EmailVerificationToken.create({
    userId: user._id,
    tokenHash: token.tokenHash,
    expiresAt,
  });

  // `URL` joins the trusted CLIENT_URL and route safely. `searchParams.set`
  // URL-encodes the raw token and presentation mode.
  const verificationUrl = new URL(
    "/verify-email",
    env.clientUrl,
  );
  verificationUrl.searchParams.set(
    "token",
    token.rawToken,
  );
  verificationUrl.searchParams.set(
    "mode",
    getVerificationMode(user.role),
  );

  return sendVerificationEmail({
    to: user.email,
    name: user.name,
    verificationUrl: verificationUrl.toString(),
  });
}

/**
 * Replaces an older reset token and sends a new one-hour link.
 * @param {{_id: import("mongoose").Types.ObjectId, email: string, name: string, role: string}} user - Password user.
 * @returns {Promise<{messageId: string}>} Delivery result.
 * @sideEffects Replaces reset record and sends/prints one reset link.
 */
async function issuePasswordResetEmail(user) {
  // Execution sequence:
  // 1. Generate a short-lived raw reset token and expiry.
  // 2. Replace old reset records with only the token hash.
  // 3. Send the raw-token URL and clean up on delivery failure.
  const token = createPasswordResetToken();
  const expiresAt = new Date(
    Date.now() +
      hoursToMilliseconds(PASSWORD_RESET_TOKEN_HOURS),
  );

  await PasswordResetToken.deleteMany({
    userId: user._id,
  });

  await PasswordResetToken.create({
    userId: user._id,
    tokenHash: token.tokenHash,
    expiresAt,
  });

  const resetUrl = new URL(
    "/reset-password",
    env.clientUrl,
  );
  resetUrl.searchParams.set(
    "token",
    token.rawToken,
  );

  if (user.role === "caregiver") {
    resetUrl.searchParams.set(
      "mode",
      "caregiver",
    );
  }

  return sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    resetUrl: resetUrl.toString(),
  });
}

/**
 * Determines whether a Family account has active linked elderly profiles.
 * @param {string} userId - Family User ID.
 * @returns {Promise<boolean>} True when onboarding has a linked profile.
 * @sideEffects Reads elderly-profile link data from MongoDB.
 */
async function hasLinkedElderlyProfiles(userId) {
  return familyHasActiveElderlyProfiles(userId);
}

/**
 * Loads role-specific fields for a public authentication response.
 * @param {object} user - Authenticated User document.
 * @returns {Promise<{linked: boolean, caregiverStatus: string|null}>} Role data.
 * @sideEffects May query elderly links or CaregiverProfile.
 */
async function loadPublicUserRoleState(user) {
  let linked = true;
  let caregiverStatus = null;

  if (user.role === "family") {
    linked = await hasLinkedElderlyProfiles(
      user._id.toString(),
    );
  }

  if (user.role === "caregiver") {
    const caregiverProfile =
      await CaregiverProfile.findOne({
        userId: user._id,
      });

    caregiverStatus =
      caregiverProfile?.applicationStatus || "draft";
  }

  return {
    linked,
    caregiverStatus,
  };
}

/**
 * Sets the signed cookie and sends the standard authentication payload.
 * @param {import("express").Response} response - Express response writer.
 * @param {object} user - Authenticated User document.
 * @returns {Promise<void>} Resolves after the response is sent.
 * @sideEffects Reads role state, signs JWT, sets cookie, and sends JSON.
 */
async function completeLogin(response, user) {
  const roleState =
    await loadPublicUserRoleState(user);
  const sessionToken = createSessionToken(user);
  const publicUser = toPublicUser(
    user,
    roleState.linked,
    roleState.caregiverStatus,
  );

  response.cookie(
    "session",
    sessionToken,
    SESSION_COOKIE_OPTIONS,
  );
  response.status(200).json({
    success: true,
    data: {
      user: publicUser,
    },
  });
}

/**
 * POST /api/auth/caregiver/signup
 * Creates an unverified Caregiver User and draft profile, then sends a link.
 * @param {import("express").Request} request - Validated signup request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>} Resolves after the 201 response.
 * @sideEffects Hashes password, creates records, and sends verification mail.
 */
export async function caregiverSignup(request, response) {
  const {
    name,
    email,
    phone,
    password,
  } = request.body;

  const existingUser = await User.findOne({
    email,
  });

  if (existingUser) {
    throw new ApiError(
      409,
      "An account already exists for this email.",
    );
  }

  const passwordHash = await bcrypt.hash(
    password,
    PASSWORD_HASH_ROUNDS,
  );
  const user = await User.create({
    name,
    email,
    password: passwordHash,
    role: "caregiver",
    isVerified: false,
  });

  let deliveryResult = null;

  try {
    await CaregiverProfile.create({
      userId: user._id,
      phone,
      applicationStatus: "draft",
    });
    deliveryResult = await issueVerificationEmail(user);
  } catch (error) {
    // These cleanup operations are independent, so `Promise.all` starts them
    // together. Signup fails rather than leaving incomplete account records.
    await Promise.all([
      User.deleteOne({
        _id: user._id,
      }),
      CaregiverProfile.deleteOne({
        userId: user._id,
      }),
      EmailVerificationToken.deleteMany({
        userId: user._id,
      }),
    ]);

    throw error;
  }

  const usedDevelopmentConsole =
    deliveryResult?.messageId ===
    "development-console-delivery";
  let message =
    "Check your inbox to verify your caregiver account.";
  let deliveryMethod = "email";

  if (usedDevelopmentConsole) {
    message =
      "SMTP is not configured. Open the caregiver verification link printed in the backend terminal.";
    deliveryMethod = "development-console";
  }

  response.status(201).json({
    success: true,
    data: {
      message,
      email: user.email,
      deliveryMethod,
    },
  });
}

/**
 * POST /api/auth/signup
 * Creates an unverified Family account and sends its verification link.
 * @param {import("express").Request} request - Validated Family signup.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>} Resolves after the 201 response.
 * @sideEffects Hashes password, creates User/token, and sends email.
 */
export async function signup(request, response) {
  // Execution sequence:
  // 1. Reject an existing email and hash the validated password.
  // 2. Create an unverified Family account.
  // 3. Send verification, rolling back the new account if delivery fails.
  // 4. Return the public account state without creating a login session.
  const {
    name,
    email,
    password,
  } = request.body;

  const existingUser = await User.findOne({
    email,
  });

  if (existingUser) {
    throw new ApiError(
      409,
      "An account already exists for this email.",
    );
  }

  const passwordHash = await bcrypt.hash(
    password,
    PASSWORD_HASH_ROUNDS,
  );
  const user = await User.create({
    name,
    email,
    password: passwordHash,
    role: "family",
    isVerified: false,
  });

  try {
    await issueVerificationEmail(user);
  } catch (error) {
    await Promise.all([
      User.deleteOne({
        _id: user._id,
      }),
      EmailVerificationToken.deleteMany({
        userId: user._id,
      }),
    ]);
    throw error;
  }

  response.status(201).json({
    success: true,
    data: {
      message:
        "Check your inbox to verify your email address.",
      email: user.email,
    },
  });
}

/**
 * POST /api/auth/login
 * Authenticates a verified Family, Caregiver, or Admin password account.
 * @param {import("express").Request} request - Validated credentials.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>} Resolves after cookie and user response.
 * @sideEffects Reads User, compares hash, and starts a session.
 */
export async function login(request, response) {
  const {
    email,
    password,
  } = request.body;

  // Password is select:false and must be requested explicitly for comparison.
  const user = await User.findOne({
    email,
  }).select("+password");

  let passwordMatches = false;

  if (user?.password) {
    passwordMatches = await bcrypt.compare(
      password,
      user.password,
    );
  }

  if (!user?.password || !passwordMatches) {
    throw new ApiError(
      401,
      "Email or password is incorrect.",
    );
  }

  // `includes` returns true when the stored role is one of the supported roles.
  const supportedRoles = [
    "family",
    "caregiver",
    "admin",
  ];

  if (!supportedRoles.includes(user.role)) {
    throw new ApiError(
      403,
      "Authentication for this role is not available yet.",
    );
  }

  if (!user.isVerified) {
    throw new ApiError(
      403,
      "Verify your email before signing in.",
      {
        code: "EMAIL_VERIFICATION_REQUIRED",
        role: user.role,
      },
    );
  }

  await completeLogin(response, user);
}

/**
 * POST /api/auth/forgot-password
 * Returns the same confirmation whether or not a password account exists.
 * @param {import("express").Request} request - Validated email request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>} Resolves after neutral response.
 * @sideEffects May replace a reset token and send email.
 */
export async function forgotPassword(request, response) {
  const user = await User.findOne({
    email: request.body.email,
    role: {
      // MongoDB `$in` matches any value in this allowlist.
      $in: [
        "family",
        "caregiver",
        "admin",
      ],
    },
  }).select("+password");

  if (user?.password) {
    await issuePasswordResetEmail(user);
  }

  response.json({
    success: true,
    data: {
      message:
        "If a password account exists for this email, a reset link has been sent.",
    },
  });
}

/**
 * POST /api/auth/reset-password
 * Replaces a password using a valid unexpired one-time token.
 * @param {import("express").Request} request - Validated token/password request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>} Resolves after password update and cookie clearing.
 * @sideEffects Updates password, deletes reset tokens, and clears session.
 */
export async function resetPassword(request, response) {
  // Execution sequence:
  // 1. Hash the URL token and load an unexpired reset record.
  // 2. Load the user, replace the password hash, and invalidate old resets.
  // 3. Return success without exposing token validity details beyond the API contract.
  const tokenHash = hashPasswordResetToken(
    request.body.token,
  );

  const resetRecord =
    await PasswordResetToken.findOne({
      tokenHash,
      expiresAt: {
        // `$gt` requires the stored expiry to be later than now.
        $gt: new Date(),
      },
    });

  if (!resetRecord) {
    throw new ApiError(
      400,
      "This password-reset link is invalid or has expired.",
    );
  }

  const user = await User.findById(
    resetRecord.userId,
  ).select("+password");

  if (!user || !user.password) {
    await PasswordResetToken.deleteMany({
      userId: resetRecord.userId,
    });

    throw new ApiError(
      400,
      "This password-reset link is invalid or has expired.",
    );
  }

  user.password = await bcrypt.hash(
    request.body.password,
    PASSWORD_HASH_ROUNDS,
  );
  await user.save();

  // Delete every reset record so this token cannot change the password again.
  await PasswordResetToken.deleteMany({
    userId: user._id,
  });

  response.clearCookie(
    "session",
    SESSION_COOKIE_CLEAR_OPTIONS,
  );
  response.json({
    success: true,
    data: {
      message:
        "Password updated. You can now sign in with your new password.",
    },
  });
}

/**
 * POST /api/auth/google
 * Signs in or creates verified Family users from Google identity.
 * @param {import("express").Request} request - Google credential request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>} Resolves after authenticated response.
 * @sideEffects Verifies Google, may update User, and sets session cookie.
 */
export async function googleLogin(request, response) {
  const credential = request.body?.credential;

  if (!credential) {
    throw new ApiError(
      422,
      "Google credential is required.",
    );
  }

  const identity =
    await verifyGoogleCredential(credential);

  if (!identity.emailVerified) {
    throw new ApiError(
      401,
      "Google has not verified this email.",
    );
  }

  let user = await User.findOne({
    email: identity.email,
  });

  if (user && user.role !== "family") {
    throw new ApiError(
      409,
      "This email belongs to an account that cannot use family Google sign-in.",
    );
  }

  if (
    user?.googleId &&
    user.googleId !== identity.googleId
  ) {
    throw new ApiError(
      409,
      "This email is already linked to a different Google identity.",
    );
  }

  if (!user) {
    user = await User.create({
      name: identity.name,
      email: identity.email,
      googleId: identity.googleId,
      role: "family",
      isVerified: true,
    });
  } else {
    if (!user.googleId) {
      user.googleId = identity.googleId;
    }

    user.isVerified = true;
    await user.save();
  }

  await completeLogin(response, user);
}

/**
 * GET /api/auth/verify-email?token=...
 * Verifies email ownership using the raw one-time link value.
 * @param {import("express").Request} request - Token query request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>} Resolves after verification response.
 * @sideEffects Reads token/User and may mark both records.
 */
export async function verifyEmail(request, response) {
  // Execution sequence:
  // 1. Validate and hash the raw URL token.
  // 2. Load the unexpired token record and its account.
  // 3. Mark email verified, consume verification tokens, and complete login.
  const rawToken = request.query.token;

  if (
    typeof rawToken !== "string" ||
    !rawToken
  ) {
    throw new ApiError(
      422,
      "Verification token is required.",
    );
  }

  const tokenHash =
    hashVerificationToken(rawToken);
  const record =
    await EmailVerificationToken.findOne({
      tokenHash,
      expiresAt: {
        // TTL deletion is delayed, so the query always enforces expiry itself.
        $gt: new Date(),
      },
    });

  if (!record) {
    throw new ApiError(
      400,
      "This verification link is invalid or has expired.",
    );
  }

  const user = await User.findById(
    record.userId,
  );

  if (!user) {
    throw new ApiError(
      404,
      "The account for this link no longer exists.",
    );
  }

  // Reopening a successfully used link is idempotent: it does not change the
  // account again, but gives a useful success message instead of confusion.
  if (user.isVerified) {
    if (!record.usedAt) {
      record.usedAt = new Date();
      await record.save();
    }

    response.json({
      success: true,
      data: {
        message:
          "Email is already verified. You can sign in.",
      },
    });
    return;
  }

  user.isVerified = true;
  record.usedAt = new Date();

  await user.save();
  await record.save();

  response.json({
    success: true,
    data: {
      message:
        "Email verified. You can now sign in.",
    },
  });
}

/**
 * POST /api/auth/resend-verification
 * Returns a neutral response to prevent account enumeration.
 * @param {import("express").Request} request - Email request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>} Resolves after neutral response.
 * @sideEffects May replace token and send verification email.
 */
export async function resendVerification(request, response) {
  let email = "";

  if (typeof request.body?.email === "string") {
    email = request.body.email
      .trim()
      .toLowerCase();
  }

  if (!email) {
    throw new ApiError(
      422,
      "Email is required.",
    );
  }

  const user = await User.findOne({
    email,
    isVerified: false,
    role: {
      $in: [
        "family",
        "caregiver",
      ],
    },
  });

  if (user) {
    await issueVerificationEmail(user);
  }

  response.json({
    success: true,
    data: {
      message:
        "If an unverified account exists, a new link has been sent.",
    },
  });
}

/**
 * GET /api/auth/me
 * Returns current public identity and role-specific state.
 * @param {import("express").Request} request - Authenticated request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>} Resolves after public user response.
 * @sideEffects May read elderly links or CaregiverProfile.
 */
export async function getCurrentUser(request, response) {
  const roleState =
    await loadPublicUserRoleState(request.user);
  const publicUser = toPublicUser(
    request.user,
    roleState.linked,
    roleState.caregiverStatus,
  );

  response.json({
    success: true,
    data: {
      user: publicUser,
    },
  });
}

/**
 * PATCH /api/auth/account
 * Updates a Family owner's name/email. An email change requires the current
 * password, makes the account unverified, sends a new link, and clears session.
 * @param {import("express").Request} request - Authenticated validated request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>} Resolves after update or verification instructions.
 * @sideEffects May update User/token, send email, and clear session cookie.
 */
export async function updateFamilyAccount(
  request,
  response,
) {
  // Password is hidden by default and selected only for this security check.
  // Step 1: Load the Family account with its hidden password.
  const account = await User.findById(
    request.user._id,
  ).select("+password");

  if (!account || account.role !== "family") {
    throw new ApiError(
      404,
      "Family account not found.",
    );
  }

  // Step 2: Preserve identity in case verification delivery fails.
  const previousState = {
    name: account.name,
    email: account.email,
    isVerified: account.isVerified,
  };
  // Step 3: Decide whether sensitive email-change rules are required.
  const emailChanged =
    request.body.email !== previousState.email;

  if (emailChanged) {
    if (!account.password) {
      throw new ApiError(
        422,
        "This Google-linked account cannot change its email here.",
        {
          email:
            "Google manages the sign-in email for this account.",
        },
      );
    }

    if (!request.body.currentPassword) {
      throw new ApiError(
        422,
        "Enter your current password to change the email address.",
        {
          currentPassword:
            "Current password is required for an email change.",
        },
      );
    }

    // Step 4: Verify the current password before changing sign-in identity.
    const passwordMatches = await bcrypt.compare(
      request.body.currentPassword,
      account.password,
    );

    if (!passwordMatches) {
      throw new ApiError(
        422,
        "The current password is incorrect.",
        {
          currentPassword:
            "The current password is incorrect.",
        },
      );
    }

    // Step 5: Reject an email already owned by another account.
    const emailOwner = await User.findOne({
      email: request.body.email,
      _id: {
        // MongoDB `$ne` means "not equal"; exclude this account itself.
        $ne: account._id,
      },
    });

    if (emailOwner) {
      throw new ApiError(
        409,
        "An account already exists for this email.",
        {
          email:
            "Choose an email address that is not already registered.",
        },
      );
    }
  }

  // Step 6: Apply the validated name and email to the document.
  account.name = request.body.name;
  account.email = request.body.email;

  if (emailChanged) {
    // requireAuth rejects unverified Family users, so every existing session
    // becomes unusable immediately after this state is saved.
    account.isVerified = false;
  }

  try {
    // Step 7: Save first, then send verification for a changed email.
    await account.save();

    if (emailChanged) {
      await issueVerificationEmail(account);
    }
  } catch (error) {
    // MongoDB error 11000 protects against a concurrent duplicate-email race.
    if (error?.code === 11000) {
      throw new ApiError(
        409,
        "An account already exists for this email.",
        {
          email:
            "Choose an email address that is not already registered.",
        },
      );
    }

    if (emailChanged) {
      // SMTP failure must not leave the owner locked out at an email address
      // that never received a verification link.
      // Step 8: Roll back identity when email delivery fails.
      account.name = previousState.name;
      account.email = previousState.email;
      account.isVerified =
        previousState.isVerified;

      await account.save();
      await EmailVerificationToken.deleteMany({
        userId: account._id,
      });
    }

    throw error;
  }

  if (emailChanged) {
    // Step 9a: End the session until the new email is verified.
    response.clearCookie(
      "session",
      SESSION_COOKIE_CLEAR_OPTIONS,
    );
    response.json({
      success: true,
      data: {
        email: account.email,
        requiresEmailVerification: true,
        message:
          "Email updated. Open the verification link sent to your new address before signing in again.",
      },
    });
    return;
  }

  // Step 9b: A name-only update keeps the session and returns the user.
  const linked =
    await hasLinkedElderlyProfiles(
      account._id.toString(),
    );
  const publicUser = toPublicUser(
    account,
    linked,
    null,
  );

  response.json({
    success: true,
    data: {
      user: publicUser,
      requiresEmailVerification: false,
      message: "Account information updated.",
    },
  });
}

/**
 * POST /api/auth/logout
 * Idempotently clears the current browser session cookie.
 * @param {import("express").Request} _request - Unused request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {void}
 * @sideEffects Clears the session cookie and sends JSON.
 */
export function logout(_request, response) {
  response.clearCookie(
    "session",
    SESSION_COOKIE_CLEAR_OPTIONS,
  );
  response.json({
    success: true,
    data: {
      message: "Signed out.",
    },
  });
}
