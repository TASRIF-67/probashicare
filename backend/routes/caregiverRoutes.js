import { Router } from "express";
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

const router = Router();

router.use(asyncHandler(requireAuth), allowRoles("caregiver"));
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
