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

// Every route below requires a valid session before role authorization is checked.
router.use(asyncHandler(requireAuth));

// Elderly profiles are currently created and managed through family accounts.
router.use(allowRoles("family"));

// Collection routes create a new profile or list profiles linked to the current family.
router.post(
  "/",
  asyncHandler(createElderlyProfile),
);

router.get(
  "/",
  asyncHandler(listElderlyProfiles),
);

// Profile routes load or replace one profile after its family link is authorized.
router.get(
  "/:profileId",
  asyncHandler(getElderlyProfile),
);

router.put(
  "/:profileId",
  asyncHandler(updateElderlyProfile),
);

// Focused updates let the frontend save one part without replacing the whole profile.
router.patch(
  "/:profileId/personal-information",
  asyncHandler(updatePersonalInformation),
);

router.put(
  "/:profileId/:section",
  asyncHandler(updateProfileSection),
);

// Archiving preserves health history while removing the profile from active workflows.
router.patch(
  "/:profileId/archive",
  asyncHandler(archiveElderlyProfile),
);

/*
 * To add a similar profile API, write a thoroughly documented controller, register
 * it here after the shared family auth middleware, add its service method in the
 * frontend, and consume that method through the profile hook or route-level page.
 */
export default router;
