import mongoose from "mongoose";

export const CARE_TASK_PRIORITIES = ["low", "medium", "high"];
export const CARE_TASK_STATUSES = ["pending", "completed", "skipped"];

const careTaskSchema = new mongoose.Schema(
  {
    elderlyProfileId: {
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
      required: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
      index: true,
    },
    visitDate: {
      type: Date,
      default: null,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    instructions: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    priority: {
      type: String,
      enum: CARE_TASK_PRIORITIES,
      default: "medium",
    },
    status: {
      type: String,
      enum: CARE_TASK_STATUSES,
      default: "pending",
      index: true,
    },
    skipReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    completedAt: {
      type: Date,
      default: null,
    },
    skippedAt: {
      type: Date,
      default: null,
    },
    lastUpdatedBy: {
      type: String,
      enum: ["family", "caregiver"],
      default: "family",
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

careTaskSchema.index({ elderlyProfileId: 1, visitDate: -1, status: 1 });

export const CareTask = mongoose.model("CareTask", careTaskSchema);
