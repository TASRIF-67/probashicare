import mongoose from "mongoose";

export const COMPLAINT_CATEGORIES = [
  "care-quality",
  "attendance",
  "communication",
  "conduct",
  "payment",
  "safety",
  "other",
];

export const COMPLAINT_STATUSES = ["open", "under-review", "resolved"];

const caregiverComplaintSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },
    caregiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    familyMemberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    elderlyProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ElderlyProfile",
      default: null,
    },
    category: {
      type: String,
      enum: COMPLAINT_CATEGORIES,
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 20,
      maxlength: 2000,
    },
    status: {
      type: String,
      enum: COMPLAINT_STATUSES,
      default: "open",
      index: true,
    },
    adminResponse: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

caregiverComplaintSchema.index(
  {
    bookingId: 1,
    familyMemberId: 1,
  },
  {
    unique: true,
  },
);
caregiverComplaintSchema.index({ status: 1, createdAt: -1 });

export const CaregiverComplaint = mongoose.model(
  "CaregiverComplaint",
  caregiverComplaintSchema,
);