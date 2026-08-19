import mongoose from "mongoose";

export const VISIT_HANDOVER_TYPES = ["final"];

const visitHandoverSchema = new mongoose.Schema(
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
      default: null,
      index: true,
    },
    caregiverUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    visitDate: {
      type: Date,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: VISIT_HANDOVER_TYPES,
      default: "final",
    },
    mood: {
      type: String,
      enum: ["good", "okay", "low", "concerned", "unknown"],
      default: "unknown",
    },
    mealsEaten: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
    incidents: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    carePlanNotes: {
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

visitHandoverSchema.index({ elderlyProfileId: 1, visitDate: -1 });

export const VisitHandover = mongoose.model("VisitHandover", visitHandoverSchema);
