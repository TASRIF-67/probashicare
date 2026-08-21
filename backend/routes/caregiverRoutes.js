import { Router } from "express";
import {
  getCaregiverAvailability,
  listCaregivers,
} from "../controllers/bookingController.js";
import { listCaregiverBookings, updateCaregiverBookingStatus } from "../controllers/bookingWorkflowController.js";
import {
  getApplication,
  saveApplicationDraft,
  submitApplication,
  updateApprovedProfile,
  uploadApplicationDocument,
} from "../controllers/caregiverController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import { checkCaregiverApplicationStatus } from "../middleware/caregiverApplication.js";
import { uploadVerificationDocument } from "../middleware/documentUpload.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  listCaregiverPublicReviews,
  listMyCaregiverReviews,
} from "../controllers/caregiverFeedbackController.js";

const router = Router();

router.get("/", asyncHandler(requireAuth), allowRoles("family", "admin"), asyncHandler(listCaregivers));
router.get(
  "/reviews/mine",
  asyncHandler(requireAuth),
  allowRoles("caregiver"),
  asyncHandler(checkCaregiverApplicationStatus("approved")),
  asyncHandler(listMyCaregiverReviews),
);
router.get(
  "/:id/reviews",
  asyncHandler(requireAuth),
  allowRoles("family", "admin"),
  asyncHandler(listCaregiverPublicReviews),
);
router.get("/:id/availability", asyncHandler(requireAuth), allowRoles("family", "admin"), asyncHandler(getCaregiverAvailability));

router.use(asyncHandler(requireAuth), allowRoles("caregiver"));
router.get("/bookings/mine", asyncHandler(checkCaregiverApplicationStatus("approved")), asyncHandler(listCaregiverBookings));
router.patch("/bookings/:bookingId/status", asyncHandler(checkCaregiverApplicationStatus("approved")), asyncHandler(updateCaregiverBookingStatus));
router.get("/application", asyncHandler(checkCaregiverApplicationStatus()), getApplication);
router.put(
  "/application/draft",
  asyncHandler(checkCaregiverApplicationStatus("draft", "rejected")),
  asyncHandler(saveApplicationDraft),
);
router.post(
  "/application/document",
  asyncHandler(checkCaregiverApplicationStatus("draft", "rejected")),
  uploadVerificationDocument,
  asyncHandler(uploadApplicationDocument),
);
router.post(
  "/application/submit",
  asyncHandler(checkCaregiverApplicationStatus("draft", "rejected")),
  asyncHandler(submitApplication),
);
router.put(
  "/profile",
  asyncHandler(checkCaregiverApplicationStatus("approved")),
  asyncHandler(updateApprovedProfile),
);

/*
 * To add a similar caregiver API, define its controller contract, place the
 * shared authentication and application-status gate here, add the frontend
 * service method, then expose it only through the matching caregiver route gate.
 */
export default router;
