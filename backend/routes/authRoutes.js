import { Router } from "express";
import {
  getCurrentUser,
  caregiverSignup,
  forgotPassword,
  googleLogin,
  login,
  logout,
  resendVerification,
  resetPassword,
  signup,
  updateFamilyAccount,
  verifyEmail,
} from "../controllers/authController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import {
  validateFamilyAccountUpdate,
  validateForgotPassword,
  validateLogin,
  validatePasswordReset,
  validateSignup,
} from "../middleware/validateAuth.js";
import { validateCaregiverSignup } from "../middleware/validateCaregiver.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/signup", validateSignup, asyncHandler(signup));
router.post("/caregiver/signup", validateCaregiverSignup, asyncHandler(caregiverSignup));
router.post("/login", validateLogin, asyncHandler(login));
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
router.post("/google", asyncHandler(googleLogin));
router.get("/verify-email", asyncHandler(verifyEmail));
router.post("/resend-verification", asyncHandler(resendVerification));
router.get("/me", asyncHandler(requireAuth), asyncHandler(getCurrentUser));
router.patch(
  "/account",
  asyncHandler(requireAuth),
  allowRoles("family"),
  validateFamilyAccountUpdate,
  asyncHandler(updateFamilyAccount),
);
router.post("/logout", logout);

/*
 * To add a similar API, define a controller with the endpoint contract comment,
 * register it here with validation/auth middleware, and add the route group to
 * app.js if it is new. Then add a method to frontend/src/services, expose it from
 * the relevant hook/context, and call that abstraction from the page or component.
 */
export default router;
