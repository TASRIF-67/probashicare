import { Router } from "express";
import {
  createGroceryRequest,
  listCaregiverGroceryRequests,
  listFamilyGroceryRequests,
  listGroceryAssignments,
  recordGroceryPurchase,
  reviewGroceryRequest,
  updateGroceryRequestStatus,
  updatePaymentSettlement,
  uploadRequestReceipt,
} from "../controllers/groceryRequestController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import { checkCaregiverApplicationStatus } from "../middleware/caregiverApplication.js";
import { uploadGroceryReceiptFile } from "../middleware/documentUpload.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
const approvedCaregiver = [
  allowRoles("caregiver"),
  asyncHandler(checkCaregiverApplicationStatus("approved")),
];

router.use(asyncHandler(requireAuth));

router.get(
  "/assignments",
  ...approvedCaregiver,
  asyncHandler(listGroceryAssignments),
);
router.get(
  "/caregiver/mine",
  ...approvedCaregiver,
  asyncHandler(listCaregiverGroceryRequests),
);
router.post(
  "/",
  ...approvedCaregiver,
  asyncHandler(createGroceryRequest),
);
router.patch(
  "/caregiver/:requestId/purchase",
  ...approvedCaregiver,
  asyncHandler(recordGroceryPurchase),
);
router.patch(
  "/caregiver/:requestId/status",
  ...approvedCaregiver,
  asyncHandler(updateGroceryRequestStatus),
);
router.post(
  "/caregiver/:requestId/receipt",
  ...approvedCaregiver,
  uploadGroceryReceiptFile,
  asyncHandler(uploadRequestReceipt),
);

router.get(
  "/family/mine",
  allowRoles("family"),
  asyncHandler(listFamilyGroceryRequests),
);
router.patch(
  "/family/:requestId/review",
  allowRoles("family"),
  asyncHandler(reviewGroceryRequest),
);
router.patch(
  "/family/:requestId/purchase",
  allowRoles("family"),
  asyncHandler(recordGroceryPurchase),
);
router.patch(
  "/family/:requestId/status",
  allowRoles("family"),
  asyncHandler(updateGroceryRequestStatus),
);
router.post(
  "/family/:requestId/receipt",
  allowRoles("family"),
  uploadGroceryReceiptFile,
  asyncHandler(uploadRequestReceipt),
);
router.patch(
  "/family/:requestId/payment-settled",
  allowRoles("family"),
  asyncHandler(updatePaymentSettlement),
);

export default router;