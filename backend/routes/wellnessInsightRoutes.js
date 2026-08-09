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
import {
  validateObjectIdParameter,
  validateResolutionNote,
  validateWellnessAlertFilters,
} from "../middleware/validateWellnessAlert.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(asyncHandler(requireAuth), allowRoles("family"));
router.get(
  "/elderly-profiles/:profileId/wellness-alerts",
  validateObjectIdParameter("profileId"),
  validateWellnessAlertFilters,
  asyncHandler(listWellnessAlerts),
);
router.get(
  "/wellness-alerts/:alertId",
  validateObjectIdParameter("alertId"),
  asyncHandler(getWellnessAlert),
);
router.patch(
  "/wellness-alerts/:alertId/acknowledge",
  validateObjectIdParameter("alertId"),
  asyncHandler(acknowledgeWellnessAlert),
);
router.patch(
  "/wellness-alerts/:alertId/resolve",
  validateObjectIdParameter("alertId"),
  validateResolutionNote,
  asyncHandler(resolveWellnessAlert),
);
router.get(
  "/elderly-profiles/:profileId/wellness-insights/latest",
  validateObjectIdParameter("profileId"),
  asyncHandler(getLatestInsight),
);
router.post(
  "/elderly-profiles/:profileId/wellness-insights/generate",
  validateObjectIdParameter("profileId"),
  asyncHandler(generateInsight),
);

export default router;
