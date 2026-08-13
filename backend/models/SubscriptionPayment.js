import mongoose from "mongoose";
import {
  ACCESS_LEVELS,
  DURATION_TYPES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  PREMIUM_ENTITLEMENTS,
  SUBSCRIPTION_PLAN_CODES,
} from "../utils/subscriptionConstants.js";

const paymentPlanSnapshotSchema = new mongoose.Schema(
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
    _id: false,
  },
);

const subscriptionPaymentSchema = new mongoose.Schema(
  {
    family: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FamilySubscription",
      required: true,
      index: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SubscriptionPlan",
      required: true,
      index: true,
    },
    planSnapshot: {
      type: paymentPlanSnapshotSchema,
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      enum: ["BDT"],
      required: true,
    },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
    },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "pending",
      index: true,
    },
    transactionReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    confirmationReference: {
      type: String,
      trim: true,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    failedAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    failureReason: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    activationAppliedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

subscriptionPaymentSchema.index(
  { confirmationReference: 1 },
  {
    unique: true,
    partialFilterExpression: {
      confirmationReference: { $type: "string" },
    },
  },
);
subscriptionPaymentSchema.index({ family: 1, createdAt: -1 });
subscriptionPaymentSchema.index({ family: 1, status: 1 });
subscriptionPaymentSchema.index({ status: 1, createdAt: -1 });
subscriptionPaymentSchema.index({ status: 1, completedAt: -1 });

export const SubscriptionPayment = mongoose.model(
  "SubscriptionPayment",
  subscriptionPaymentSchema,
);
