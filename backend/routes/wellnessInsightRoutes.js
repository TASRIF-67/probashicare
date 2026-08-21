import { Router } from "express";
import {
  acknowledgeWellnessAlert,
  generateInsight,
  getLatestInsight,
  getWellnessAlert,
  listWellnessAlerts,
  resolveWellnessAlert,
} from "../controllers/wellnessInsightController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import { requireFamilyEntitlement } from "../middleware/requireFamilyEntitlement.js";
import {
  validateObjectIdParameter,
  validateResolutionNote,
  validateWellnessAlertFilters,
} from "../middleware/validateWellnessAlert.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ENTITLEMENTS } from "../utils/subscriptionConstants.js";

const router = Router();

router.use(asyncHandler(requireAuth), allowRoles("family"));
router.get(
  "/elderly-profiles/:profileId/wellness-alerts",
  asyncHandler(
    requireFamilyEntitlement(ENTITLEMENTS.WELLNESS_EARLY_ALERTS),
  ),
  validateObjectIdParameter("profileId"),
  validateWellnessAlertFilters,
  asyncHandler(listWellnessAlerts),
);
router.get(
  "/wellness-alerts/:alertId",
  asyncHandler(
    requireFamilyEntitlement(ENTITLEMENTS.WELLNESS_EARLY_ALERTS),
  ),
  validateObjectIdParameter("alertId"),
  asyncHandler(getWellnessAlert),
);
router.patch(
  "/wellness-alerts/:alertId/acknowledge",
  asyncHandler(
    requireFamilyEntitlement(ENTITLEMENTS.WELLNESS_EARLY_ALERTS),
  ),
  validateObjectIdParameter("alertId"),
  asyncHandler(acknowledgeWellnessAlert),
);
router.patch(
  "/wellness-alerts/:alertId/resolve",
  asyncHandler(
    requireFamilyEntitlement(ENTITLEMENTS.WELLNESS_EARLY_ALERTS),
  ),
  validateObjectIdParameter("alertId"),
  validateResolutionNote,
  asyncHandler(resolveWellnessAlert),
);
router.get(
  "/elderly-profiles/:profileId/wellness-insights/latest",
  asyncHandler(
    requireFamilyEntitlement(ENTITLEMENTS.WELLNESS_AI_SUMMARY),
  ),
  validateObjectIdParameter("profileId"),
  asyncHandler(getLatestInsight),
);
router.post(
  "/elderly-profiles/:profileId/wellness-insights/generate",
  asyncHandler(
    requireFamilyEntitlement(ENTITLEMENTS.WELLNESS_AI_SUMMARY),
  ),
  validateObjectIdParameter("profileId"),
  asyncHandler(generateInsight),
);

export default router;
