import mongoose from "mongoose";
import {
  ACCESS_LEVELS,
  DURATION_TYPES,
  PREMIUM_ENTITLEMENTS,
  SUBSCRIPTION_PLAN_CODES,
} from "../utils/subscriptionConstants.js";

// One document represents one backend-controlled plan currently offered.
const subscriptionPlanSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      enum: SUBSCRIPTION_PLAN_CODES,
      required: true,
      unique: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    accessLevel: {
      type: String,
      enum: ACCESS_LEVELS,
      required: true,
    },
    durationType: {
      type: String,
      enum: DURATION_TYPES,
      required: true,
    },
    durationValue: {
      type: Number,
      required: true,
      min: 1,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: ["BDT"],
      required: true,
      uppercase: true,
      trim: true,
    },
    features: {
      type: [String],
      enum: PREMIUM_ENTITLEMENTS,
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    // Mongoose maintains createdAt and updatedAt automatically.
    timestamps: true,
  },
);

// The catalog query filters active plans and sorts by price.
subscriptionPlanSchema.index({
  isActive: 1,
  price: 1,
});

export const SubscriptionPlan = mongoose.model(
  "SubscriptionPlan",
  subscriptionPlanSchema,
);
