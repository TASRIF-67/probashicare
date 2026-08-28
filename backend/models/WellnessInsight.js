import mongoose from "mongoose";

/*
 * mongoose.Schema creates validation and storage rules for documents in the
 * wellnessinsights MongoDB collection. It does not insert data by itself.
 */
const wellnessInsightSchema = new mongoose.Schema(
  {
    elderlyProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ElderlyProfile",
      required: true,
      index: true,
    },
    reportIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "WellnessReport",
        required: true,
      },
    ],
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
    highlights: [
      {
        type: String,
        trim: true,
        maxlength: 300,
      },
    ],
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
    // timestamps adds createdAt and updatedAt to every saved insight.
    timestamps: true,
  },
);

/*
 * The number 1 means ascending index order and -1 means descending order.
 * This index supports finding one profile's newest generated insight.
 */
wellnessInsightSchema.index({
  elderlyProfileId: 1,
  generatedAt: -1,
});

/*
 * This index supports the cooldown lookup for the same profile and exact set
 * of source reports. Indexes improve reads but add storage and write cost.
 */
wellnessInsightSchema.index({
  elderlyProfileId: 1,
  reportSignature: 1,
  generatedAt: -1,
});

/*
 * mongoose.model creates the query interface. WellnessInsight.findOne reads
 * documents, while WellnessInsight.create validates and inserts a document.
 */
export const WellnessInsight = mongoose.model(
  "WellnessInsight",
  wellnessInsightSchema,
);
