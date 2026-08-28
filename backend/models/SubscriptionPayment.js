import mongoose from "mongoose";
import {
  ACCESS_LEVELS,
  DURATION_TYPES,
  PAYMENT_METHODS,
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
  PREMIUM_ENTITLEMENTS,
  SUBSCRIPTION_PLAN_CODES,
} from "../utils/subscriptionConstants.js";

// Every payment keeps its own immutable plan snapshot. A later catalog update
// must not alter the amount, duration, or benefits shown in payment history.
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
    // `family` is used for ownership. Family endpoints always combine this
    // field with the authenticated request.user._id.
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
    provider: {
      type: String,
      enum: PAYMENT_PROVIDERS,
      default: "prototype",
      required: true,
    },
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "pending",
      index: true,
    },

    // The application creates this before any provider checkout begins.
    transactionReference: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // This exists only after successful simulated/provider confirmation.
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

    // Non-null means this payment already activated access. It is the local
    // idempotency guard against a repeated success request/webhook.
    activationAppliedAt: {
      type: Date,
      default: null,
    },

    // Stripe identifiers correlate the local payment with signed provider
    // events. Partial unique indexes permit null/legacy values.
    stripeCheckoutSessionId: {
      type: String,
      trim: true,
    },
    stripePaymentIntentId: {
      type: String,
      trim: true,
    },
    stripeEventId: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// A confirmation reference is unique when it exists.
subscriptionPaymentSchema.index(
  {
    confirmationReference: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      confirmationReference: {
        $type: "string",
      },
    },
  },
);

// These compound indexes match Family history and Admin reporting queries.
subscriptionPaymentSchema.index({
  family: 1,
  createdAt: -1,
});
subscriptionPaymentSchema.index({
  family: 1,
  status: 1,
});
subscriptionPaymentSchema.index({
  status: 1,
  createdAt: -1,
});
subscriptionPaymentSchema.index({
  status: 1,
  completedAt: -1,
});

// Provider IDs must never activate two local payment documents.
subscriptionPaymentSchema.index(
  {
    stripeCheckoutSessionId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      stripeCheckoutSessionId: {
        $type: "string",
      },
    },
  },
);
subscriptionPaymentSchema.index(
  {
    stripePaymentIntentId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      stripePaymentIntentId: {
        $type: "string",
      },
    },
  },
);
subscriptionPaymentSchema.index(
  {
    stripeEventId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      stripeEventId: {
        $type: "string",
      },
    },
  },
);

export const SubscriptionPayment = mongoose.model(
  "SubscriptionPayment",
  subscriptionPaymentSchema,
);
