import mongoose from "mongoose";
import {
  ACCESS_LEVELS,
  DURATION_TYPES,
  PREMIUM_ENTITLEMENTS,
  SUBSCRIPTION_PLAN_CODES,
  SUBSCRIPTION_STATUSES,
} from "../utils/subscriptionConstants.js";

// A snapshot copies the plan terms that were active when access began. Later
// catalog price/feature changes must not rewrite an existing family's history.
const planSnapshotSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      enum: SUBSCRIPTION_PLAN_CODES,
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
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
    },
    features: {
      type: [String],
      enum: PREMIUM_ENTITLEMENTS,
      default: [],
    },
  },
  {
    // The embedded snapshot belongs to its parent and needs no separate ID.
    _id: false,
  },
);

// Exactly one FamilySubscription document may belong to each family account.
const familySubscriptionSchema = new mongoose.Schema(
  {
    family: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    currentPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      default: null,
    },
    accessLevel: {
      type: String,
      enum: ACCESS_LEVELS,
      default: "core",
      index: true,
    },
    status: {
      type: String,
      enum: SUBSCRIPTION_STATUSES,
      default: "none",
      index: true,
    },
    trialUsed: {
      type: Boolean,
      default: false,
    },
    trialStartedAt: {
      type: Date,
      default: null,
    },
    trialEndsAt: {
      type: Date,
      default: null,
    },
    currentPeriodStartedAt: {
      type: Date,
      default: null,
    },
    currentPeriodEndsAt: {
      type: Date,
      default: null,
      index: true,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    planSnapshot: {
      type: planSnapshotSchema,
      default: null,
    },
    // Access checks update this timestamp when they persist an expiry.
    lastExpiryCheckAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Supports expiry scans such as active records whose ending time has passed.
familySubscriptionSchema.index({
  status: 1,
  currentPeriodEndsAt: 1,
});

export const FamilySubscription = mongoose.model(
  "FamilySubscription",
  familySubscriptionSchema,
);
