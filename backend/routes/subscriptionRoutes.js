import { Router } from "express";
import {
  activateMyTrial,
  cancelMySubscription,
  cancelPrototypePayment,
  cancelStripeCheckout,
  createStripeCheckout,
  getMySubscription,
  getMyStripeCheckoutStatus,
  listMySubscriptionPayments,
  listSubscriptionPlans,
  purchaseSubscription,
  simulatePaymentFailure,
  simulatePaymentSuccess,
} from "../controllers/subscriptionController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import {
  validateSubscriptionCancellation,
  validateSubscriptionObjectId,
  validateSubscriptionPurchase,
  validateStripeCheckout,
} from "../middleware/validateSubscription.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// Every catalog/access/payment endpoint requires a verified session.
router.use(asyncHandler(requireAuth));

// Any authenticated role may read the public plan catalog.
router.get("/plans", asyncHandler(listSubscriptionPlans));

// Every route declared below this line is Family-only.
router.use(allowRoles("family"));

router.get("/me", asyncHandler(getMySubscription));
router.post("/trial/activate", asyncHandler(activateMyTrial));

router.post(
  "/purchase",
  validateSubscriptionPurchase,
  asyncHandler(purchaseSubscription),
);

router.post(
  "/stripe/checkout",
  validateStripeCheckout,
  asyncHandler(createStripeCheckout),
);
router.get(
  "/stripe/checkouts/:sessionId",
  asyncHandler(getMyStripeCheckoutStatus),
);
router.post(
  "/stripe/payments/:paymentId/cancel",
  validateSubscriptionObjectId("paymentId"),
  asyncHandler(cancelStripeCheckout),
);

router.patch(
  "/me/cancel",
  validateSubscriptionCancellation,
  asyncHandler(cancelMySubscription),
);

router.get("/payments", asyncHandler(listMySubscriptionPayments));
router.post(
  "/payments/:paymentId/simulate-success",
  validateSubscriptionObjectId("paymentId"),
  asyncHandler(simulatePaymentSuccess),
);
router.post(
  "/payments/:paymentId/simulate-failure",
  validateSubscriptionObjectId("paymentId"),
  asyncHandler(simulatePaymentFailure),
);
router.post(
  "/payments/:paymentId/cancel",
  validateSubscriptionObjectId("paymentId"),
  asyncHandler(cancelPrototypePayment),
);

export default router;
