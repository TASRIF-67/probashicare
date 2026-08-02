import { Router } from "express";
import {
  archiveElderlyProfile,
  createElderlyProfile,
  getElderlyProfile,
  listElderlyProfiles,
  updatePersonalInformation,
  updateElderlyProfile,
  updateProfileSection,
} from "../controllers/elderlyProfileController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(asyncHandler(requireAuth), allowRoles("family"));
router.route("/").post(asyncHandler(createElderlyProfile)).get(asyncHandler(listElderlyProfiles));
router.route("/:profileId").get(asyncHandler(getElderlyProfile)).put(asyncHandler(updateElderlyProfile));
router.patch("/:profileId/personal-information", asyncHandler(updatePersonalInformation));
router.put("/:profileId/:section", asyncHandler(updateProfileSection));
router.patch("/:profileId/archive", asyncHandler(archiveElderlyProfile));

/*
 * To add a similar profile API, write a thoroughly documented controller, register
 * it here after the shared family auth middleware, add its service method in the
 * frontend, and consume that method through the profile hook or route-level page.
 */
export default router;
