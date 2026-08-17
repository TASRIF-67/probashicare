import { Router } from "express";
import { cancelMyBooking, createBooking, listMyBookings } from "../controllers/bookingWorkflowController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import { validateBookingRequest } from "../middleware/validateBooking.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { requireFamilyEntitlement } from "../middleware/requireFamilyEntitlement.js";
import { ENTITLEMENTS } from "../utils/subscriptionConstants.js";
import {
  listMyComplaints,
  submitCaregiverComplaint,
  submitCaregiverReview,
} from "../controllers/caregiverFeedbackController.js";

const router = Router();

router.post(
  "/",
  asyncHandler(requireAuth),
  allowRoles("family"),
  asyncHandler(requireFamilyEntitlement(ENTITLEMENTS.CAREGIVER_BOOKING)),
  validateBookingRequest,
  asyncHandler(createBooking),
);
router.get("/", asyncHandler(requireAuth), allowRoles("family"), asyncHandler(listMyBookings));
router.get("/my-bookings", asyncHandler(requireAuth), allowRoles("family"), asyncHandler(listMyBookings));
router.get(
  "/complaints/mine",
  asyncHandler(requireAuth),
  allowRoles("family"),
  asyncHandler(listMyComplaints),
);
router.post(
  "/:bookingId/review",
  asyncHandler(requireAuth),
  allowRoles("family"),
  asyncHandler(submitCaregiverReview),
);
router.post(
  "/:bookingId/complaint",
  asyncHandler(requireAuth),
  allowRoles("family"),
  asyncHandler(submitCaregiverComplaint),
);
router.patch("/:bookingId/cancel", asyncHandler(requireAuth), allowRoles("family"), asyncHandler(cancelMyBooking));

export default router;
