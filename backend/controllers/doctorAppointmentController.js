import mongoose from "mongoose";
import { DoctorAppointment } from "../models/DoctorAppointment.js";
import { User } from "../models/User.js";
import { getAuthorizedElderlyProfile } from "../services/elderlyProfileAccessService.js";
import {
  createDoctorVisitCalendarEvent,
  deleteCalendarEvent,
} from "../services/googleCalendarService.js";
import { createNotification } from "../services/notificationService.js";
import { ApiError } from "../utils/ApiError.js";

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

export async function createDoctorAppointment(request, response) {
  const payload = request.body ?? {};
  ensureValidDoctorDetails(payload);

  if (!mongoose.isValidObjectId(payload.elderlyId)) {
    throw new ApiError(400, "elderlyId is invalid.");
  }

  await getAuthorizedElderlyProfile({
    profileId: payload.elderlyId,
    familyUserId: request.user._id,
    permissions: ["owner", "editor", "viewer"],
  });

  const familyCalendarId = request.user?.email || process.env.GOOGLE_CALENDAR_ID;

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
    .populate("caregiverUserId", "name email");

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

  try {
    const googleEvent = await createDoctorVisitCalendarEvent({
      appointment: populatedAppointment,
      caregiverEmail: caregiverUser?.email || null,
      calendarId: familyCalendarId,
    });

    if (googleEvent?.id) {
      populatedAppointment.googleCalendarEventId = googleEvent.id;
      await populatedAppointment.save();
    }
  } catch (calendarError) {
    console.error("Doctor appointment calendar sync failed:", calendarError);
  }

  response.status(201).json({
    success: true,
    data: {
      appointment: populatedAppointment,
    },
  });
}

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
    .populate("caregiverUserId", "name email")
    .sort({ appointmentDate: 1 });

  const now = new Date();

  const upcoming = appointments.filter(
    (appointment) => ["scheduled", "rejected"].includes(appointment.status) && new Date(appointment.appointmentDate) >= now,
  );

  const history = appointments.filter(
    (appointment) => !["scheduled", "rejected"].includes(appointment.status) || new Date(appointment.appointmentDate) < now,
  );

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

export async function updateDoctorAppointmentStatus(request, response) {
  const { status, reason } = request.body ?? {};

  if (!status || !["completed", "cancelled", "rejected"].includes(status)) {
    throw new ApiError(422, "Status must be completed, rejected, or cancelled.");
  }

  const appointment = await DoctorAppointment.findById(request.params.id);

  if (!appointment) {
    throw new ApiError(404, "Doctor appointment not found.");
  }

  const isFamilyOwner = request.user.role === "family" && appointment.familyUserId.toString() === request.user._id.toString();
  const isAssignedCaregiver = request.user.role === "caregiver" && appointment.caregiverUserId && appointment.caregiverUserId.toString() === request.user._id.toString();

  if (!isFamilyOwner && !isAssignedCaregiver) {
    throw new ApiError(403, "You are not authorized to update this appointment.");
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

  if (status === "cancelled" && appointment.googleCalendarEventId) {
    await deleteCalendarEvent(appointment.googleCalendarEventId);
    appointment.googleCalendarEventId = null;
  }

  await appointment.save();

  response.json({
    success: true,
    data: {
      appointment,
    },
  });
}

export async function deleteDoctorAppointment(request, response) {
  const appointment = await DoctorAppointment.findById(request.params.id);

  if (!appointment) {
    throw new ApiError(404, "Doctor appointment not found.");
  }

  const isFamilyOwner = request.user.role === "family" && appointment.familyUserId.toString() === request.user._id.toString();

  if (!isFamilyOwner) {
    throw new ApiError(403, "Only the family owner can delete this appointment.");
  }

  if (appointment.googleCalendarEventId) {
    await deleteCalendarEvent(appointment.googleCalendarEventId);
  }

  await DoctorAppointment.deleteOne({ _id: appointment._id });

  response.json({
    success: true,
    data: {
      deletedAppointmentId: appointment._id.toString(),
    },
  });
}
