import { Router } from "express";
import {
  deleteFamilyUser,
  getAdminOverview,
  listUsers,
} from "../controllers/adminUserController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  approveCaregiverApplication,
  getCaregiverApplication,
  listCaregiverApplications,
  rejectCaregiverApplication,
} from "../controllers/adminCaregiverController.js";

const router = Router();

router.use(asyncHandler(requireAuth), allowRoles("admin"));
router.get("/overview", asyncHandler(getAdminOverview));
router.get("/users", asyncHandler(listUsers));
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
