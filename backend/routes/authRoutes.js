import { Router } from "express";
import {
  getCurrentUser,
  googleLogin,
  login,
  logout,
  resendVerification,
  signup,
  verifyEmail,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { validateLogin, validateSignup } from "../middleware/validateAuth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/signup", validateSignup, asyncHandler(signup));
router.post("/login", validateLogin, asyncHandler(login));
router.post("/google", asyncHandler(googleLogin));
router.get("/verify-email", asyncHandler(verifyEmail));
router.post("/resend-verification", asyncHandler(resendVerification));
router.get("/me", asyncHandler(requireAuth), asyncHandler(getCurrentUser));
router.post("/logout", logout);

/*
 * To add a similar API, define a controller with the endpoint contract comment,
 * register it here with validation/auth middleware, and add the route group to
 * app.js if it is new. Then add a method to frontend/src/services, expose it from
 * the relevant hook/context, and call that abstraction from the page or component.
 */
export default router;
