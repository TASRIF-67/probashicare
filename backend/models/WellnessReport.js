import mongoose from "mongoose";

export const WELLNESS_REPORT_STATUSES = ["draft", "submitted"];
export const MOOD_OPTIONS = ["excellent", "good", "okay", "low", "distressed"];
export const MEAL_STATUSES = ["full", "partial", "missed", "not-applicable"];
export const MEDICINE_INTAKE_STATUSES = [
  "all-taken",
  "partially-taken",
  "missed",
  "not-scheduled",
  "unknown",
];

export const BLOOD_SUGAR_CONTEXTS = [
  "fasting",
  "before-meal",
  "after-meal",
  "random",
  "unknown",
];

const vitalsSchema = new mongoose.Schema(
  {
    systolic: { type: Number, min: 50, max: 260, default: null },
    diastolic: { type: Number, min: 30, max: 180, default: null },
    bloodSugar: { type: Number, min: 20, max: 600, default: null },
    bloodSugarContext: {
      type: String,
      enum: BLOOD_SUGAR_CONTEXTS,
      default: "unknown",
    },
    weightKg: { type: Number, min: 20, max: 300, default: null },
    measuredAt: { type: Date, default: null },
  },
  { _id: false },
);

const wellnessReportSchema = new mongoose.Schema(
  {
    elderlyProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ElderlyProfile",
      required: true,
      index: true,
    },
    caregiverUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    careAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CareAssignment",
      required: true,
      index: true,
    },
    visitDate: { type: Date, required: true, index: true },
    checkInAt: { type: Date, default: null },
    checkOutAt: { type: Date, default: null },
    mood: { type: String, enum: MOOD_OPTIONS, default: null },
    mealStatus: { type: String, enum: MEAL_STATUSES, default: null },
    mealNotes: { type: String, trim: true, maxlength: 500, default: "" },
    medicineIntakeStatus: {
      type: String,
      enum: MEDICINE_INTAKE_STATUSES,
      default: null,
    },
    medicineNotes: { type: String, trim: true, maxlength: 500, default: "" },
    vitals: { type: vitalsSchema, default: () => ({}) },
    exerciseDurationMinutes: { type: Number, min: 0, max: 600, default: null },
    observations: { type: String, trim: true, maxlength: 2000, default: "" },
    caregiverNotes: { type: String, trim: true, maxlength: 1500, default: "" },
    nextVisitDate: { type: Date, default: null },
    status: {
      type: String,
      enum: WELLNESS_REPORT_STATUSES,
      default: "draft",
      index: true,
    },
    submittedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

wellnessReportSchema.index({ elderlyProfileId: 1, status: 1, visitDate: -1 });
wellnessReportSchema.index({ caregiverUserId: 1, status: 1, visitDate: -1 });
wellnessReportSchema.index({ careAssignmentId: 1, visitDate: -1 });

/*
 * To add another visit record, create a separate time-series model linked to
 * ElderlyProfile and CareAssignment. Add validation, controllers, routes, route
 * registration, a frontend service, and focused pages or hooks. Do not append
 * growing visit history arrays to ElderlyProfile.
 */
export const WellnessReport = mongoose.model("WellnessReport", wellnessReportSchema);
