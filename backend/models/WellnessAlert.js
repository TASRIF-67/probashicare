import mongoose from "mongoose";

export const WELLNESS_ALERT_CATEGORIES = [
  "blood_pressure",
  "blood_sugar",
  "weight",
  "medicine",
  "meal",
  "mood",
];
export const WELLNESS_ALERT_SEVERITIES = ["low", "medium", "high"];
export const WELLNESS_ALERT_STATUSES = ["active", "acknowledged", "resolved"];

const wellnessAlertSchema = new mongoose.Schema(
  {
    elderlyProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ElderlyProfile",
      required: true,
      index: true,
    },
    sourceReportIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "WellnessReport",
      required: true,
    }],
    category: {
      type: String,
      enum: WELLNESS_ALERT_CATEGORIES,
      required: true,
    },
    severity: {
      type: String,
      enum: WELLNESS_ALERT_SEVERITIES,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 600,
    },
    detectedValues: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    triggeredRules: [{
      type: String,
      required: true,
      trim: true,
    }],
    dedupeKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: WELLNESS_ALERT_STATUSES,
      default: "active",
      index: true,
    },
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    acknowledgedAt: {
      type: Date,
      default: null,
    },
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
    resolutionNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

wellnessAlertSchema.index({
  elderlyProfileId: 1,
  status: 1,
  severity: 1,
  createdAt: -1,
});
wellnessAlertSchema.index({
  elderlyProfileId: 1,
  category: 1,
  createdAt: -1,
});

/*
 * A similar derived-health record should reference its source reports, keep an
 * audit trail, expose narrow family-authorized routes, and be generated through
 * a dedicated service rather than being embedded in ElderlyProfile.
 */
export const WellnessAlert = mongoose.model(
  "WellnessAlert",
  wellnessAlertSchema,
);
