import { Router } from "express";
import {
  deleteFamilyUser,
  getAdminOverview,
  listUsers,
} from "../controllers/adminUserController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(asyncHandler(requireAuth), allowRoles("admin"));
router.get("/overview", asyncHandler(getAdminOverview));
router.get("/users", asyncHandler(listUsers));
router.delete("/users/:userId", asyncHandler(deleteFamilyUser));

/*
 * To add a similar admin API, document its complete contract in a controller,
 * register it after this shared admin gate, add a method to the frontend admin
 * service, and consume it from an admin-only page with explicit confirmation for
 * destructive actions.
 */
export default router;
