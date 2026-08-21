import { Router } from "express";
import {
  createDoctorAppointment,
  deleteDoctorAppointment,
  listDoctorAppointments,
  updateDoctorAppointmentStatus,
} from "../controllers/doctorAppointmentController.js";
import { allowRoles, requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(asyncHandler(requireAuth));

router.post(
  "/",
  allowRoles("family"),
  asyncHandler(createDoctorAppointment),
);

router.get(
  "/",
  allowRoles("family", "caregiver"),
  asyncHandler(listDoctorAppointments),
);

router.patch(
  "/:id/status",
  allowRoles("family", "caregiver"),
  asyncHandler(updateDoctorAppointmentStatus),
);

router.delete(
  "/:id",
  allowRoles("family"),
  asyncHandler(deleteDoctorAppointment),
);

export default router;
