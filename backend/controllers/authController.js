import bcrypt from "bcryptjs";
import { EmailVerificationToken } from "../models/EmailVerificationToken.js";
import { User } from "../models/User.js";
import { env } from "../config/env.js";
import { sendVerificationEmail } from "../services/emailService.js";
import { verifyGoogleCredential } from "../services/googleAuthService.js";
import { ApiError } from "../utils/ApiError.js";
import {
  createSessionToken,
  createVerificationToken,
  hashVerificationToken,
} from "../utils/authTokens.js";
import { toPublicUser } from "../utils/userResponse.js";
import { familyHasActiveElderlyProfiles } from "../services/elderlyProfileAccessService.js";
import { CaregiverProfile } from "../models/CaregiverProfile.js";

const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.nodeEnv === "production",
  sameSite: env.nodeEnv === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

/**
 * Persists a fresh verification token and emails its raw value to the user.
 * @param {{_id: import("mongoose").Types.ObjectId, email: string, name: string}} user - Unverified user.
 * @returns {Promise<{messageId: string}>} SMTP provider message identifier.
 * @sideEffects Replaces verification token records and sends an email.
 */
async function issueVerificationEmail(user) {
  const { rawToken, tokenHash } = createVerificationToken();
  await EmailVerificationToken.deleteMany({ userId: user._id });
  await EmailVerificationToken.create({
    userId: user._id,
    tokenHash,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });
  const verificationUrl = new URL("/verify-email", env.clientUrl);
  verificationUrl.searchParams.set("token", rawToken);
  verificationUrl.searchParams.set("mode", user.role === "caregiver" ? "caregiver" : "family");
  return sendVerificationEmail({
    to: user.email,
    name: user.name,
    verificationUrl: verificationUrl.toString(),
  });
}

/**
 * Determines whether a family account has linked elderly profiles.
 * @param {string} userId - Authenticated family user ID.
 * @returns {Promise<boolean>} Whether the family has at least one active linked elderly profile.
 * @sideEffects Reads ElderlyFamilyLink and ElderlyProfile from MongoDB.
 */
async function hasLinkedElderlyProfiles(userId) {
  return familyHasActiveElderlyProfiles(userId);
}

/**
 * Sets the signed session cookie and returns the standard authentication payload.
 * @param {import("express").Response} response - Express response writer.
 * @param {import("../models/User.js").User} user - Authenticated User document.
 * @returns {Promise<void>}
 * @sideEffects Signs a JWT, sets an HTTP-only cookie, and sends a 200 response.
 */
async function completeLogin(response, user) {
  const linked = user.role === "family" ? await hasLinkedElderlyProfiles(user._id.toString()) : true;
  const caregiverProfile =
    user.role === "caregiver" ? await CaregiverProfile.findOne({ userId: user._id }) : null;
  response
    .cookie("session", createSessionToken(user), SESSION_COOKIE_OPTIONS)
    .status(200)
    .json({
      success: true,
      data: {
        user: toPublicUser(
          user,
          linked,
          user.role === "caregiver" ? caregiverProfile?.applicationStatus || "draft" : null,
        ),
      },
    });
}

/**
 * POST /api/auth/caregiver/signup
 * Body: `{ name: string, email: string, phone: string, password: string, confirmPassword: string }`.
 * Success 201: `{ success: true, data: { message: string, email: string } }`.
 * Failure: standard conflict, validation, mail, or database error shape.
 * Auth: public; always creates an unverified caregiver User and draft CaregiverProfile.
 * @param {import("express").Request} request - Validated caregiver signup request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Creates User/Profile records, hashes a password, and sends verification email.
 */
export async function caregiverSignup(request, response) {
  const { name, email, phone, password } = request.body;
  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, "An account already exists for this email.");

  const user = await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 12),
    role: "caregiver",
    isVerified: false,
  });

  let deliveryResult;

  try {
    await CaregiverProfile.create({ userId: user._id, phone, applicationStatus: "draft" });
    deliveryResult = await issueVerificationEmail(user);
  } catch (error) {
    await Promise.all([
      User.deleteOne({ _id: user._id }),
      CaregiverProfile.deleteOne({ userId: user._id }),
      EmailVerificationToken.deleteMany({ userId: user._id }),
    ]);
    throw error;
  }

  const usedDevelopmentConsole =
    deliveryResult?.messageId === "development-console-delivery";
  const message = usedDevelopmentConsole
    ? "SMTP is not configured. Open the caregiver verification link printed in the backend terminal."
    : "Check your inbox to verify your caregiver account.";

  response.status(201).json({
    success: true,
    data: {
      message,
      email: user.email,
      deliveryMethod: usedDevelopmentConsole
        ? "development-console"
        : "email",
    },
  });
}

/**
 * POST /api/auth/signup
 * Body: `{ name: string, email: string, password: string }`.
 * Success 201: `{ success: true, data: { message: string, email: string } }`.
 * Failure: `{ success: false, error: { message: string, details: object|null } }`.
 * Auth: public; always creates the `family` role. Admin and elderly signup is forbidden.
 * @param {import("express").Request} request - Validated signup request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Hashes a password, creates a User and verification token, and sends email.
 */
export async function signup(request, response) {
  const { name, email, password } = request.body;
  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, "An account already exists for this email.");

  const user = await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 12),
    role: "family",
    isVerified: false,
  });

  try {
    await issueVerificationEmail(user);
  } catch (error) {
    await Promise.all([
      User.deleteOne({ _id: user._id }),
      EmailVerificationToken.deleteMany({ userId: user._id }),
    ]);
    throw error;
  }

  response.status(201).json({
    success: true,
    data: { message: "Check your inbox to verify your email address.", email: user.email },
  });
}

/**
 * POST /api/auth/login
 * Body: `{ email: string, password: string }`.
 * Success 200: `{ success: true, data: { user: PublicUser } }` plus session cookie.
 * Failure: standard error shape; unverified accounts receive 403.
 * Auth: public; supports verified family/caregiver accounts and seeded admin accounts.
 * @param {import("express").Request} request - Validated login request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads the database, compares a password hash, and sets a session cookie.
 */
export async function login(request, response) {
  const { email, password } = request.body;
  const user = await User.findOne({ email }).select("+password");

  if (!user?.password || !(await bcrypt.compare(password, user.password))) {
    throw new ApiError(401, "Email or password is incorrect.");
  }
  if (!["family", "caregiver", "admin"].includes(user.role)) {
    throw new ApiError(403, "Authentication for this role is not available yet.");
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
 * POST /api/auth/google
 * Body: `{ credential: string }` from Google Identity Services.
 * Success 200: `{ success: true, data: { user: PublicUser } }` plus session cookie.
 * Failure: standard error shape; rejects malformed/unverified Google identities.
 * Auth: public; signs in or creates family users only and never creates caregivers/admins.
 * @param {import("express").Request} request - Request containing a Google ID token.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Verifies with Google, reads/writes a family User, and sets a session cookie.
 */
export async function googleLogin(request, response) {
  if (!request.body?.credential) throw new ApiError(422, "Google credential is required.");
  const identity = await verifyGoogleCredential(request.body.credential);
  if (!identity.emailVerified) throw new ApiError(401, "Google has not verified this email.");

  let user = await User.findOne({ email: identity.email });
  if (user && user.role !== "family") {
    throw new ApiError(409, "This email belongs to an account that cannot use family Google sign-in.");
  }
  if (user?.googleId && user.googleId !== identity.googleId) {
    throw new ApiError(409, "This email is already linked to a different Google identity.");
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
    user.googleId ||= identity.googleId;
    user.isVerified = true;
    await user.save();
  }

  await completeLogin(response, user);
}

/**
 * GET /api/auth/verify-email?token=...
 * Query: `{ token: string }`.
 * Success 200: `{ success: true, data: { message: string } }`.
 * Failure: standard error shape for absent, invalid, or expired links.
 * Auth: public; possession of the one-time token authorizes verification.
 * @param {import("express").Request} request - Request containing the raw token.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Marks User verified and records when its token was first used.
 */
export async function verifyEmail(request, response) {
  const rawToken = request.query.token;
  if (typeof rawToken !== "string" || !rawToken) {
    throw new ApiError(422, "Verification token is required.");
  }

  const record = await EmailVerificationToken.findOne({
    tokenHash: hashVerificationToken(rawToken),
    expiresAt: { $gt: new Date() },
  });
  if (!record) throw new ApiError(400, "This verification link is invalid or has expired.");

  const user = await User.findById(record.userId);
  if (!user) throw new ApiError(404, "The account for this link no longer exists.");

  if (user.isVerified) {
    if (!record.usedAt) {
      record.usedAt = new Date();
      await record.save();
    }

    response.json({
      success: true,
      data: {
        message: "Email is already verified. You can sign in.",
      },
    });
    return;
  }

  user.isVerified = true;
  await user.save();

  record.usedAt = new Date();
  await record.save();

  response.json({
    success: true,
    data: {
      message: "Email verified. You can now sign in.",
    },
  });
}

/**
 * POST /api/auth/resend-verification
 * Body: `{ email: string }`.
 * Success 200: always returns a neutral `{ success, data: { message } }` response.
 * Failure: standard error shape for invalid input or mail service failure.
 * Auth: public; neutral responses prevent account enumeration.
 * @param {import("express").Request} request - Request containing an email.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects May replace a verification token and send email.
 */
export async function resendVerification(request, response) {
  const email = request.body?.email?.trim().toLowerCase();
  if (!email) throw new ApiError(422, "Email is required.");
  const user = await User.findOne({
    email,
    isVerified: false,
    role: { $in: ["family", "caregiver"] },
  });
  if (user) await issueVerificationEmail(user);
  response.json({
    success: true,
    data: { message: "If an unverified account exists, a new link has been sent." },
  });
}

/**
 * GET /api/auth/me
 * Body/params/query: none.
 * Success 200: `{ success: true, data: { user: PublicUser } }`.
 * Failure: standard 401 error shape.
 * Auth: any authenticated active role; current clients use family, caregiver, and admin.
 * @param {import("express").Request} request - Authenticated request with `request.user`.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects May query elderly-profile existence once that module is connected.
 */
export async function getCurrentUser(request, response) {
  const linked =
    request.user.role === "family"
      ? await hasLinkedElderlyProfiles(request.user._id.toString())
      : true;
  const caregiverProfile =
    request.user.role === "caregiver"
      ? await CaregiverProfile.findOne({ userId: request.user._id })
      : null;
  response.json({
    success: true,
    data: {
      user: toPublicUser(
        request.user,
        linked,
        request.user.role === "caregiver"
          ? caregiverProfile?.applicationStatus || "draft"
          : null,
      ),
    },
  });
}

/**
 * PATCH /api/auth/account
 * Auth: verified Family account only.
 * Body: `{ name: string, email: string, currentPassword?: string }`.
 * Success 200: updated public user for name-only changes, or verification instructions
 * when the email changes. An email change requires the current password, marks the
 * account unverified, sends a new one-time link, and clears the current session.
 * Failure 409/422/500: duplicate email, validation/password failure, or mail failure.
 * A failed mail send restores the previous email and verification state so the family
 * owner is not locked out. Other existing sessions become unusable after a successful
 * email change because authentication middleware rejects unverified accounts.
 * @param {import("express").Request} request - Authenticated and validated family request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects May update User, create an EmailVerificationToken, send SMTP email, and clear the session cookie.
 */
export async function updateFamilyAccount(request, response) {
  const account = await User.findById(request.user._id).select(
    "+password",
  );

  if (!account || account.role !== "family") {
    throw new ApiError(404, "Family account not found.");
  }

  const previousName = account.name;
  const previousEmail = account.email;
  const previousVerificationState = account.isVerified;
  const emailChanged = request.body.email !== previousEmail;

  if (emailChanged) {
    if (!account.password) {
      throw new ApiError(
        422,
        "This Google-linked account cannot change its email here.",
        {
          email: "Google manages the sign-in email for this account.",
        },
      );
    }

    if (!request.body.currentPassword) {
      throw new ApiError(
        422,
        "Enter your current password to change the email address.",
        {
          currentPassword: "Current password is required for an email change.",
        },
      );
    }

    const passwordMatches = await bcrypt.compare(
      request.body.currentPassword,
      account.password,
    );

    if (!passwordMatches) {
      throw new ApiError(
        422,
        "The current password is incorrect.",
        {
          currentPassword: "The current password is incorrect.",
        },
      );
    }

    const emailOwner = await User.findOne({
      email: request.body.email,
      _id: {
        $ne: account._id,
      },
    });

    if (emailOwner) {
      throw new ApiError(
        409,
        "An account already exists for this email.",
        {
          email: "Choose an email address that is not already registered.",
        },
      );
    }
  }

  account.name = request.body.name;
  account.email = request.body.email;

  if (emailChanged) {
    account.isVerified = false;
  }

  try {
    await account.save();

    if (emailChanged) {
      await issueVerificationEmail(account);
    }
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(
        409,
        "An account already exists for this email.",
        {
          email: "Choose an email address that is not already registered.",
        },
      );
    }

    if (emailChanged) {
      account.name = previousName;
      account.email = previousEmail;
      account.isVerified = previousVerificationState;
      await account.save();
      await EmailVerificationToken.deleteMany({
        userId: account._id,
      });
    }

    throw error;
  }

  if (emailChanged) {
    response
      .clearCookie("session", {
        httpOnly: true,
        secure: env.nodeEnv === "production",
        sameSite: env.nodeEnv === "production" ? "none" : "lax",
      })
      .json({
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

  const linked = await hasLinkedElderlyProfiles(account._id.toString());

  response.json({
    success: true,
    data: {
      user: toPublicUser(account, linked, null),
      requiresEmailVerification: false,
      message: "Account information updated.",
    },
  });
}

/**
 * POST /api/auth/logout
 * Body/params/query: none.
 * Success 200: `{ success: true, data: { message: string } }`.
 * Failure: shared standard error shape.
 * Auth: public and idempotent so expired sessions can still be cleared.
 * @param {import("express").Request} _request - Express request, unused.
 * @param {import("express").Response} response - Express response writer.
 * @returns {void}
 * @sideEffects Clears the browser session cookie.
 */
export function logout(_request, response) {
  response
    .clearCookie("session", {
      httpOnly: true,
      secure: env.nodeEnv === "production",
      sameSite: env.nodeEnv === "production" ? "none" : "lax",
    })
    .json({ success: true, data: { message: "Signed out." } });
}
