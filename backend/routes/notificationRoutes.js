import { Router } from "express";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../controllers/notificationController.js";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(asyncHandler(requireAuth));
router.get("/", asyncHandler(listNotifications));
router.get("/unread-count", asyncHandler(getUnreadNotificationCount));
router.patch("/read-all", asyncHandler(markAllNotificationsAsRead));
router.patch(
  "/:notificationId/read",
  asyncHandler(markNotificationAsRead),
);

export default router;
