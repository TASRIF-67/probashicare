import { Router } from "express";
import {
  dismissNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notificationController.js";
import { requireAuth } from "../middleware/auth.js";
import {
  validateReminderDismissal,
  validateSubscriptionObjectId,
} from "../middleware/validateSubscription.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

// Every notification endpoint requires a verified session. `router.use` applies
// this middleware to every route declared below it.
router.use(asyncHandler(requireAuth));

// GET /api/notifications?page=1&limit=20&unread=true
router.get("/", asyncHandler(listNotifications));

// Keep this fixed route above `/:notificationId/...` so Express does not treat
// "read-all" as a notification ID.
router.patch("/read-all", asyncHandler(markAllNotificationsRead));

// The shared ObjectId validator rejects malformed IDs before Mongoose queries.
router.patch(
  "/:notificationId/read",
  validateSubscriptionObjectId("notificationId"),
  asyncHandler(markNotificationRead),
);

// Dismissal middleware validates and stores hours on
// `request.reminderDismissalHours` before the controller uses it.
router.patch(
  "/:notificationId/dismiss",
  validateSubscriptionObjectId("notificationId"),
  validateReminderDismissal,
  asyncHandler(dismissNotification),
);

export default router;
