import mongoose from "mongoose";
import { CaregiverProfile } from "../models/CaregiverProfile.js";
import { DoctorAppointment } from "../models/DoctorAppointment.js";
import { User } from "../models/User.js";
import { getAuthorizedElderlyProfile } from "../services/elderlyProfileAccessService.js";
import {
  createDoctorVisitCalendarEvent,
  deleteCalendarEvent,
} from "../services/googleCalendarService.js";
import { createNotification } from "../services/notificationService.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Validates required appointment fields and the appointment date.
 * @param {object} payload - Family-submitted appointment values.
 * @returns {void}
 * @sideEffects Throws an ApiError when validation fails.
 */
function ensureValidDoctorDetails(payload) {
  const requiredFields = [
    "elderlyId",
    "doctorName",
    "specialty",
    "clinicName",
    "clinicAddress",
    "contactPhone",
    "appointmentDate",
  ];

  for (const field of requiredFields) {
    if (!payload[field]) {
      throw new ApiError(400, `${field} is required.`);
    }
  }

  const appointmentDate = new Date(payload.appointmentDate);
  if (Number.isNaN(appointmentDate.getTime())) {
    throw new ApiError(400, "appointmentDate must be a valid date.");
  }
}

/**
 * Creates a doctor appointment for an authorized elderly profile.
 * POST /api/doctor-appointments
 * @param {import("express").Request} request - Authenticated family request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads users/profiles, creates an appointment and notification, optionally creates a Calendar event, and sends HTTP 201.
 */
export async function createDoctorAppointment(request, response) {
  const payload = request.body ?? {};
  ensureValidDoctorDetails(payload);

  if (!mongoose.isValidObjectId(payload.elderlyId)) {
    throw new ApiError(400, "elderlyId is invalid.");
  }

  await getAuthorizedElderlyProfile({
    profileId: payload.elderlyId,
    familyUserId: request.user._id,
    permissions: ["owner", "editor"],
  });

  let caregiverUser = null;
  if (payload.caregiverUserId) {
    if (!mongoose.isValidObjectId(payload.caregiverUserId)) {
      throw new ApiError(400, "caregiverUserId is invalid.");
    }

    caregiverUser = await User.findOne({
      _id: payload.caregiverUserId,
      role: "caregiver",
    });

    if (!caregiverUser) {
      throw new ApiError(404, "Assigned caregiver not found.");
    }

    const caregiverProfile = await CaregiverProfile.findOne({
      userId: caregiverUser._id,
      applicationStatus: "approved",
    });

    if (!caregiverProfile) {
      throw new ApiError(404, "Assigned caregiver not found.");
    }
  }

  const appointment = await DoctorAppointment.create({
    elderlyId: payload.elderlyId,
    familyUserId: request.user._id,
    caregiverUserId: caregiverUser ? caregiverUser._id : null,
    doctorName: payload.doctorName,
    specialty: payload.specialty,
    clinicName: payload.clinicName,
    clinicAddress: payload.clinicAddress,
    contactPhone: payload.contactPhone,
    appointmentDate: payload.appointmentDate,
    notes: payload.notes || "",
    status: "scheduled",
  });

  const populatedAppointment = await DoctorAppointment.findById(appointment._id)
    .populate("elderlyId", "name personalInformation")
    .populate("caregiverUserId", "name");

  if (caregiverUser) {
    await createNotification({
      recipientUserId: caregiverUser._id,
      actorUserId: request.user._id,
      type: "doctor-appointment-assigned",
      priority: "important",
      title: "Doctor escort assigned",
      message: `${request.user.name || "A family member"} assigned you as the escort for ${populatedAppointment.doctorName}.`,
      actionPath: "/caregiver/doctor-visits",
      relatedEntityType: "booking",
      relatedEntityId: populatedAppointment._id,
      eventKey: `doctor-appointment:${populatedAppointment._id}:assigned`,
    });
  }

  const calendarSync = await createDoctorVisitCalendarEvent({
    appointment: populatedAppointment,
    caregiverEmail: caregiverUser?.email || null,
  });

  if (calendarSync.event?.id) {
    populatedAppointment.googleCalendarEventId =
      calendarSync.event.id;
    await populatedAppointment.save();
  }

  response.status(201).json({
    success: true,
    data: {
      appointment: populatedAppointment,
      calendarSync: {
        status: calendarSync.status,
        message: calendarSync.message,
      },
    },
  });
}

/**
 * Lists appointments visible to the signed-in family or caregiver.
 * GET /api/doctor-appointments
 * @param {import("express").Request} request - Authenticated request with optional elderlyId query.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads appointments and sends separate upcoming/history collections.
 */
export async function listDoctorAppointments(request, response) {
  const filter = {};
  const { elderlyId } = request.query;

  if (request.user.role === "family") {
    filter.familyUserId = request.user._id;
  } else if (request.user.role === "caregiver") {
    filter.caregiverUserId = request.user._id;
  }

  if (elderlyId) {
    if (!mongoose.isValidObjectId(String(elderlyId))) {
      throw new ApiError(400, "elderlyId is invalid.");
    }
    filter.elderlyId = elderlyId;
  }

  const appointments = await DoctorAppointment.find(filter)
    .populate("elderlyId", "name personalInformation")
    // Caregiver email is intentionally excluded from appointment responses.
    .populate("caregiverUserId", "name")
    .sort({ appointmentDate: 1 });

  const now = new Date();
  const upcoming = [];
  const history = [];

  for (const appointment of appointments) {
    const isScheduled = appointment.status === "scheduled";
    const hasNotPassed =
      new Date(appointment.appointmentDate) >= now;

    if (isScheduled && hasNotPassed) {
      upcoming.push(appointment);
    } else {
      history.push(appointment);
    }
  }

  response.json({
    success: true,
    data: {
      appointments,
      upcoming,
      history,
      count: appointments.length,
    },
  });
}

/**
 * Completes, cancels, or declines an appointment using role-specific transitions.
 * PATCH /api/doctor-appointments/:id/status
 * @param {import("express").Request} request - Authenticated family or assigned-caregiver request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Updates one appointment, may delete its Calendar event, and sends JSON.
 */
export async function updateDoctorAppointmentStatus(request, response) {
  const { status, reason } = request.body ?? {};

  if (!status || !["completed", "cancelled", "rejected"].includes(status)) {
    throw new ApiError(422, "Status must be completed, rejected, or cancelled.");
  }

  const appointment = await DoctorAppointment.findById(request.params.id);

  if (!appointment) {
    throw new ApiError(404, "Doctor appointment not found.");
  }

  const isFamilyOwner =
    request.user.role === "family"
    && appointment.familyUserId.toString()
      === request.user._id.toString();
  const isAssignedCaregiver =
    request.user.role === "caregiver"
    && appointment.caregiverUserId
    && appointment.caregiverUserId.toString()
      === request.user._id.toString();

  if (!isFamilyOwner && !isAssignedCaregiver) {
    throw new ApiError(403, "You are not authorized to update this appointment.");
  }

  if (appointment.status !== "scheduled") {
    throw new ApiError(
      409,
      "Only a scheduled appointment can change status.",
    );
  }

  if (isFamilyOwner && status === "rejected") {
    throw new ApiError(
      403,
      "Only the assigned caregiver can decline this visit.",
    );
  }

  if (isAssignedCaregiver && status === "cancelled") {
    throw new ApiError(
      403,
      "Only the family can cancel this visit.",
    );
  }

  if (status === "rejected") {
    const trimmedReason = String(reason || "").trim();
    if (!trimmedReason) {
      throw new ApiError(422, "Please tell the family why you cannot join.");
    }
    appointment.statusReason = trimmedReason.slice(0, 1000);
  } else {
    appointment.statusReason = "";
  }

  appointment.status = status;

  let calendarSync = null;

  if (
    status === "cancelled"
    && appointment.googleCalendarEventId
  ) {
    calendarSync = await deleteCalendarEvent(
      appointment.googleCalendarEventId,
    );

    if (calendarSync.status === "deleted") {
      appointment.googleCalendarEventId = null;
    }
  }

  await appointment.save();

  response.json({
    success: true,
    data: {
      appointment,
      calendarSync,
    },
  });
}

/**
 * Permanently removes a family-owned appointment.
 * DELETE /api/doctor-appointments/:id
 * @param {import("express").Request} request - Authenticated family request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects May delete a Calendar event, deletes the appointment, and sends JSON.
 */
export async function deleteDoctorAppointment(request, response) {
  const appointment = await DoctorAppointment.findById(request.params.id);

  if (!appointment) {
    throw new ApiError(404, "Doctor appointment not found.");
  }

  const isFamilyOwner =
    request.user.role === "family"
    && appointment.familyUserId.toString()
      === request.user._id.toString();

  if (!isFamilyOwner) {
    throw new ApiError(403, "Only the family owner can delete this appointment.");
  }

  let calendarSync = null;

  if (appointment.googleCalendarEventId) {
    calendarSync = await deleteCalendarEvent(
      appointment.googleCalendarEventId,
    );
  }

  await DoctorAppointment.deleteOne({ _id: appointment._id });

  response.json({
    success: true,
    data: {
      deletedAppointmentId: appointment._id.toString(),
      calendarSync,
    },
  });
}
