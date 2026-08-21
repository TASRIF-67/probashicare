import { Router } from "express";
import {
  createCareTask,
  createVisitHandover,
  deleteCareTask,
  listCareVisitTasks,
  listVisitHandovers,
  updateCareTask,
  updateCareTaskStatus,
} from "../controllers/careVisitController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(asyncHandler(requireAuth));

router.get(
  "/tasks",
  allowRoles("family", "caregiver"),
  asyncHandler(listCareVisitTasks),
);
router.post(
  "/tasks",
  allowRoles("family"),
  asyncHandler(createCareTask),
);
router.put(
  "/tasks/:taskId",
  allowRoles("family"),
  asyncHandler(updateCareTask),
);
router.delete(
  "/tasks/:taskId",
  allowRoles("family"),
  asyncHandler(deleteCareTask),
);
router.patch(
  "/tasks/:taskId/status",
  allowRoles("caregiver"),
  asyncHandler(updateCareTaskStatus),
);
router.get(
  "/handover/:profileId",
  allowRoles("family", "caregiver"),
  asyncHandler(listVisitHandovers),
);
router.post(
  "/handover",
  allowRoles("caregiver"),
  asyncHandler(createVisitHandover),
);

export default router;
