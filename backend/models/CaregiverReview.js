import mongoose from "mongoose";

export const REVIEW_MODERATION_STATUSES = ["published", "hidden"];

const caregiverReviewSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      unique: true,
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
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: "Rating must be a whole number.",
      },
    },
    feedback: {
      type: String,
      trim: true,
      maxlength: 1500,
      default: "",
    },
    moderationStatus: {
      type: String,
      enum: REVIEW_MODERATION_STATUSES,
      default: "published",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

caregiverReviewSchema.index({
  caregiverId: 1,
  moderationStatus: 1,
  createdAt: -1,
});
caregiverReviewSchema.index({ familyMemberId: 1, createdAt: -1 });

export const CaregiverReview = mongoose.model(
  "CaregiverReview",
  caregiverReviewSchema,
);
