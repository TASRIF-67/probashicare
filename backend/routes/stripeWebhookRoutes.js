import { Router } from "express";
import { receiveStripeWebhook } from "../controllers/stripeWebhookController.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/", asyncHandler(receiveStripeWebhook));

export default router;
