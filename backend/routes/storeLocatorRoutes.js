import { Router } from "express";
import {
  geocodeStoreArea,
  listNearbyStores,
} from "../controllers/storeLocatorController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(asyncHandler(requireAuth));
router.use(allowRoles("family", "caregiver"));
router.get("/geocode", asyncHandler(geocodeStoreArea));
router.get("/nearby", asyncHandler(listNearbyStores));

export default router;
