import mongoose from "mongoose";

export const GROCERY_REQUEST_STATUSES = [
  "submitted",
  "approved",
  "purchasing",
  "purchased",
  "ordered",
  "out-for-delivery",
  "delivered",
  "rejected",
  "cancelled",
];

export const GROCERY_FULFILLMENT_METHODS = [
  "caregiver-purchase",
  "family-remote-order",
];

export const GROCERY_PAYMENT_ARRANGEMENTS = [
  "caregiver-paid-reimbursement-pending",
  "family-transferred-beforehand",
  "cash-on-delivery",
  "family-paid-store-directly",
  "settled-outside-probashicare",
];

const groceryItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    category: {
      type: String,
      enum: [
        "grocery",
        "household",
        "personal-care",
        "pharmacy",
        "other",
      ],
      default: "grocery",
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.01,
      max: 10000,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 300,
      default: "",
    },
  },
  {
    _id: true,
  },
);

const storeSnapshotSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      enum: ["openstreetmap", "manual", "external-provider"],
      default: "manual",
    },
    externalId: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },
    name: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "",
    },
    category: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      maxlength: 400,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 50,
      default: "",
    },
    latitude: {
      type: Number,
      min: -90,
      max: 90,
      default: null,
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180,
      default: null,
    },
  },
  {
    _id: false,
  },
);

const purchaseReceiptSchema = new mongoose.Schema(
  {
    publicId: {
      type: String,
      required: true,
    },
    resourceType: {
      type: String,
      default: "image",
    },
    format: {
      type: String,
      default: "",
    },
    originalName: {
      type: String,
      default: "",
    },
    bytes: {
      type: Number,
      default: 0,
    },
    uploadedAt: {
      type: Date,
      default: null,
    },
  },
  {
    _id: false,
  },
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: GROCERY_REQUEST_STATUSES,
      required: true,
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    changedByRole: {
      type: String,
      enum: ["family", "caregiver", "admin"],
      required: true,
    },
    note: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  },
);

const groceryRequestSchema = new mongoose.Schema(
  {
    elderlyProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ElderlyProfile",
      required: true,
      index: true,
    },
    caregiverUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    careAssignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CareAssignment",
      required: true,
      index: true,
    },
    sourceBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
    },
    items: {
      type: [groceryItemSchema],
      required: true,
      validate: {
        /**
         * Keeps each request useful without allowing an excessively large list.
         * @param {Array<object>} items - Embedded grocery item records.
         * @returns {boolean} True when the request contains 1 to 30 items.
         * @sideEffects None.
         */
        validator: function validateItemCount(items) {
          return items.length >= 1 && items.length <= 30;
        },
        message: "Add between 1 and 30 requested items.",
      },
    },
    urgency: {
      type: String,
      enum: ["normal", "urgent"],
      default: "normal",
      index: true,
    },
    neededBy: {
      type: Date,
      default: null,
    },
    caregiverNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    estimatedBudget: {
      type: Number,
      min: 0,
      max: 10000000,
      default: null,
    },
    approvedBudget: {
      type: Number,
      min: 0,
      max: 10000000,
      default: null,
    },
    fulfillmentMethod: {
      type: String,
      enum: GROCERY_FULFILLMENT_METHODS,
      default: null,
    },
    familyDecisionNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    actualTotal: {
      type: Number,
      min: 0,
      max: 10000000,
      default: null,
    },
    paymentArrangement: {
      type: String,
      enum: GROCERY_PAYMENT_ARRANGEMENTS,
      default: null,
    },
    paymentSettled: {
      type: Boolean,
      default: false,
    },
    externalOrderReference: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "",
    },
    purchaseNote: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    selectedStore: {
      type: storeSnapshotSchema,
      default: null,
    },
    receipt: {
      type: purchaseReceiptSchema,
      default: null,
    },
    status: {
      type: String,
      enum: GROCERY_REQUEST_STATUSES,
      default: "submitted",
      index: true,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    purchasedAt: {
      type: Date,
      default: null,
    },
    deliveredAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

groceryRequestSchema.index({ caregiverUserId: 1, createdAt: -1 });
groceryRequestSchema.index({ elderlyProfileId: 1, status: 1, createdAt: -1 });
groceryRequestSchema.index({ status: 1, urgency: 1, createdAt: -1 });

export const GroceryRequest = mongoose.model(
  "GroceryRequest",
  groceryRequestSchema,
);
