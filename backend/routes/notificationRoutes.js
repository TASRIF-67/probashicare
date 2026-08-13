import { Router } from "express";
import {
  dismissNotification,
  listNotifications,
  markNotificationRead,
} from "../controllers/notificationController.js";
import { requireAuth } from "../middleware/auth.js";
import {
  validateReminderDismissal,
  validateSubscriptionObjectId,
} from "../middleware/validateSubscription.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(asyncHandler(requireAuth));
router.get("/", asyncHandler(listNotifications));
router.patch(
  "/:notificationId/read",
  validateSubscriptionObjectId("notificationId"),
  asyncHandler(markNotificationRead),
);
router.patch(
  "/:notificationId/dismiss",
  validateSubscriptionObjectId("notificationId"),
  validateReminderDismissal,
  asyncHandler(dismissNotification),
);

export default router;
