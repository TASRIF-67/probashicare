import mongoose from "mongoose";

const doctorAppointmentSchema = new mongoose.Schema(
  {
    elderlyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ElderlyProfile",
      required: true,
      index: true,
    },
    familyUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    caregiverUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    doctorName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    specialty: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    clinicName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    clinicAddress: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },
    contactPhone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    appointmentDate: {
      type: Date,
      required: true,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled", "rejected"],
      default: "scheduled",
      index: true,
    },
    statusReason: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    googleCalendarEventId: {
      type: String,
      default: null,
      trim: true,
    },
  },
  { timestamps: true },
);

doctorAppointmentSchema.index({ elderlyId: 1, appointmentDate: -1 });
doctorAppointmentSchema.index({ familyUserId: 1, status: 1, appointmentDate: -1 });
doctorAppointmentSchema.index({ caregiverUserId: 1, status: 1, appointmentDate: -1 });

export const DoctorAppointment = mongoose.model(
  "DoctorAppointment",
  doctorAppointmentSchema,
);
