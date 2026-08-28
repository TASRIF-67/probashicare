import { Router } from "express";
import {
  caregiverSignup,
  forgotPassword,
  getCurrentUser,
  googleLogin,
  login,
  logout,
  resendVerification,
  resetPassword,
  signup,
  updateFamilyAccount,
  verifyEmail,
} from "../controllers/authController.js";
import {
  allowRoles,
  requireAuth,
} from "../middleware/auth.js";
import {
  validateFamilyAccountUpdate,
  validateForgotPassword,
  validateLogin,
  validatePasswordReset,
  validateSignup,
} from "../middleware/validateAuth.js";
import {
  validateCaregiverSignup,
} from "../middleware/validateCaregiver.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// Public account creation and sign-in routes.
router.post(
  "/signup",
  validateSignup,
  asyncHandler(signup),
);
router.post(
  "/caregiver/signup",
  validateCaregiverSignup,
  asyncHandler(caregiverSignup),
);
router.post(
  "/login",
  validateLogin,
  asyncHandler(login),
);
router.post(
  "/google",
  asyncHandler(googleLogin),
);

// Public recovery and email-ownership routes. Their one-time tokens provide
// authorization, so a session cookie is not required.
router.post(
  "/forgot-password",
  validateForgotPassword,
  asyncHandler(forgotPassword),
);
router.post(
  "/reset-password",
  validatePasswordReset,
  asyncHandler(resetPassword),
);
router.get(
  "/verify-email",
  asyncHandler(verifyEmail),
);
router.post(
  "/resend-verification",
  asyncHandler(resendVerification),
);

// Session and Family-owner account-management routes.
router.get(
  "/me",
  asyncHandler(requireAuth),
  asyncHandler(getCurrentUser),
);
router.patch(
  "/account",
  asyncHandler(requireAuth),
  allowRoles("family"),
  validateFamilyAccountUpdate,
  asyncHandler(updateFamilyAccount),
);

// Logout is intentionally idempotent and can clear an expired cookie.
router.post(
  "/logout",
  logout,
);

export default router;
