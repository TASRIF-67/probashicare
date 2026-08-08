import { Router } from "express";
import { createBooking, listMyBookings } from "../controllers/bookingController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import { validateBookingRequest } from "../middleware/validateBooking.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/", asyncHandler(requireAuth), allowRoles("family"), validateBookingRequest, asyncHandler(createBooking));
router.get("/my-bookings", asyncHandler(requireAuth), allowRoles("family"), asyncHandler(listMyBookings));

export default router;
