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
const requireScheduledBooking = requireFamilyEntitlement(
  ENTITLEMENTS.SCHEDULED_BOOKING,
);
const requireLongTermBooking = requireFamilyEntitlement(
  ENTITLEMENTS.LONG_TERM_BOOKING,
);

/**
 * Requires the additional entitlement attached to a recurring booking type.
 * @param {import("express").Request} request - Request containing validated bookingInput.
 * @param {import("express").Response} response - Express response passed to entitlement middleware.
 * @param {import("express").NextFunction} next - Express continuation function.
 * @returns {Promise<void>|void} Completes after the selected entitlement check or continues immediately.
 * @sideEffects May read subscription access and attach it to the request.
 */
function requireBookingScheduleEntitlement(request, response, next) {
  const bookingType = request.bookingInput?.bookingType;

  if (bookingType === "scheduled") {
    return requireScheduledBooking(request, response, next);
  }

  if (bookingType === "long-term") {
    return requireLongTermBooking(request, response, next);
  }

  next();
}

router.post(
  "/",
  asyncHandler(requireAuth),
  allowRoles("family"),
  asyncHandler(requireFamilyEntitlement(ENTITLEMENTS.CAREGIVER_BOOKING)),
  validateBookingRequest,
  asyncHandler(requireBookingScheduleEntitlement),
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
