import mongoose from "mongoose";

const wellnessInsightSchema = new mongoose.Schema(
  {
    elderlyProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ElderlyProfile",
      required: true,
      index: true,
    },
    reportIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "WellnessReport",
      required: true,
    }],
    reportSignature: {
      type: String,
      required: true,
      index: true,
    },
    periodStart: {
      type: Date,
      required: true,
    },
    periodEnd: {
      type: Date,
      required: true,
    },
    summary: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1200,
    },
    highlights: [{
      type: String,
      trim: true,
      maxlength: 300,
    }],
    recommendedFollowUp: {
      type: String,
      required: true,
      trim: true,
      maxlength: 600,
    },
    generatedBy: {
      type: String,
      enum: ["gemini", "fallback"],
      required: true,
    },
    generatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
);

wellnessInsightSchema.index({
  elderlyProfileId: 1,
  generatedAt: -1,
});
wellnessInsightSchema.index({
  elderlyProfileId: 1,
  reportSignature: 1,
  generatedAt: -1,
});

export const WellnessInsight = mongoose.model(
  "WellnessInsight",
  wellnessInsightSchema,
);
