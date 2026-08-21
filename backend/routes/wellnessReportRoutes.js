import { Router } from "express";
import {
  createWellnessReport,
  getElderlyVitalsTrends,
  getWellnessReport,
  listCaregiverReportAssignments,
  listElderlyWellnessReports,
  listMyWellnessReports,
  submitWellnessReport,
  updateWellnessReportDraft,
} from "../controllers/wellnessReportController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import { checkCaregiverApplicationStatus } from "../middleware/caregiverApplication.js";
import { requireFamilyEntitlement } from "../middleware/requireFamilyEntitlement.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ENTITLEMENTS } from "../utils/subscriptionConstants.js";

const router = Router();
const approvedCaregiver = [
  allowRoles("caregiver"),
  asyncHandler(checkCaregiverApplicationStatus("approved")),
];

router.use(asyncHandler(requireAuth));
router.get(
  "/assignments",
  ...approvedCaregiver,
  asyncHandler(listCaregiverReportAssignments),
);
router.get(
  "/mine",
  ...approvedCaregiver,
  asyncHandler(listMyWellnessReports),
);
router.post(
  "/",
  ...approvedCaregiver,
  asyncHandler(createWellnessReport),
);
router.put(
  "/:reportId",
  ...approvedCaregiver,
  asyncHandler(updateWellnessReportDraft),
);
router.post(
  "/:reportId/submit",
  ...approvedCaregiver,
  asyncHandler(submitWellnessReport),
);
router.get(
  "/elderly/:profileId/vitals",
  allowRoles("family"),
  asyncHandler(requireFamilyEntitlement(ENTITLEMENTS.ADVANCED_VITALS)),
  asyncHandler(getElderlyVitalsTrends),
);
router.get(
  "/elderly/:profileId",
  allowRoles("family"),
  asyncHandler(listElderlyWellnessReports),
);
router.get(
  "/:reportId",
  allowRoles("family", "caregiver"),
  asyncHandler(getWellnessReport),
);

/*
 * To add a similar wellness endpoint, add the documented controller, place the
 * narrow role/application gate here, add a matching frontend service method,
 * and consume it through the report form, history page, or a focused hook.
 */
export default router;
