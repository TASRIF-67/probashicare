import { Router } from "express";
import {
  deleteFamilyUser,
  getAdminOverview,
  listUsers,
} from "../controllers/adminUserController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getSubscriptionAnalytics,
  listSubscriptionPayments,
} from "../controllers/adminSubscriptionController.js";
import {
  approveCaregiverApplication,
  getCaregiverApplication,
  listCaregiverApplications,
  rejectCaregiverApplication,
} from "../controllers/adminCaregiverController.js";
import { listAdminBookings } from "../controllers/adminBookingController.js";
import {
  listAdminCaregiverComplaints,
  listAdminCaregiverReviews,
  moderateCaregiverReview,
  updateCaregiverComplaint,
} from "../controllers/caregiverFeedbackController.js";

const router = Router();

router.use(asyncHandler(requireAuth), allowRoles("admin"));
router.get("/overview", asyncHandler(getAdminOverview));
router.get("/bookings", asyncHandler(listAdminBookings));
router.get("/caregiver-reviews", asyncHandler(listAdminCaregiverReviews));
router.patch(
  "/caregiver-reviews/:reviewId/moderation",
  asyncHandler(moderateCaregiverReview),
);
router.get("/caregiver-complaints", asyncHandler(listAdminCaregiverComplaints));
router.patch(
  "/caregiver-complaints/:complaintId",
  asyncHandler(updateCaregiverComplaint),
);
router.get("/users", asyncHandler(listUsers));
router.get("/subscriptions/analytics", asyncHandler(getSubscriptionAnalytics));
router.get("/subscriptions/payments", asyncHandler(listSubscriptionPayments));
router.delete("/users/:userId", asyncHandler(deleteFamilyUser));
router.get("/caregiver-applications", asyncHandler(listCaregiverApplications));
router.get("/caregiver-applications/:profileId", asyncHandler(getCaregiverApplication));
router.patch(
  "/caregiver-applications/:profileId/approve",
  asyncHandler(approveCaregiverApplication),
);
router.patch(
  "/caregiver-applications/:profileId/reject",
  asyncHandler(rejectCaregiverApplication),
);

/*
 * To add a similar admin API, document its complete contract in a controller,
 * register it after this shared admin gate, add a method to the frontend admin
 * service, and consume it from an admin-only page with explicit confirmation for
 * destructive actions.
 */
export default router;
