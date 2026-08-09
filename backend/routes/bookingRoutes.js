import { Router } from "express";
import { cancelMyBooking, createBooking, listMyBookings } from "../controllers/bookingWorkflowController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import { validateBookingRequest } from "../middleware/validateBooking.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/", asyncHandler(requireAuth), allowRoles("family"), validateBookingRequest, asyncHandler(createBooking));
router.get("/", asyncHandler(requireAuth), allowRoles("family"), asyncHandler(listMyBookings));
router.get("/my-bookings", asyncHandler(requireAuth), allowRoles("family"), asyncHandler(listMyBookings));
router.patch("/:bookingId/cancel", asyncHandler(requireAuth), allowRoles("family"), asyncHandler(cancelMyBooking));

export default router;
