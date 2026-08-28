import { Router } from "express";
import { receiveStripeWebhook } from "../controllers/stripeWebhookController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// This route does not use a user session. Stripe-Signature verification in the
// controller/service authenticates the provider event instead.
router.post("/", asyncHandler(receiveStripeWebhook));

export default router;
