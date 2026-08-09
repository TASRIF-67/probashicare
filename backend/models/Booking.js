import mongoose from "mongoose";

export const BOOKING_TYPES = ["one-time", "scheduled", "long-term"];
export const BOOKING_STATUSES = ["pending", "accepted", "declined", "confirmed", "completed", "cancelled"];

const occurrenceSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    timeSlot: {
      type: String,
      required: true,
      match: /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/,
    },
  },
  { _id: false },
);

const bookingSlotSchema = new mongoose.Schema(
  {
    weekday: { type: String, enum: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"], required: true },
    startTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, required: true },
    endTime: { type: String, match: /^([01]\d|2[0-3]):[0-5]\d$/, required: true },
  },
  { _id: false },
);

const bookingSchema = new mongoose.Schema(
  {
    familyMemberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    caregiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    elderlyProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ElderlyProfile",
      required: false,
      index: true,
    },
    bookingType: {
      type: String,
      enum: BOOKING_TYPES,
      required: true,
      index: true,
    },
    serviceType: {
      type: String,
      required: true,
      trim: true,
      default: "companionship",
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    timeSlot: {
      type: String,
      required: true,
      trim: true,
      match: /^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$/,
    },
    slots: { type: [bookingSlotSchema], default: [] },
    occurrences: { type: [occurrenceSchema], default: [] },
    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: "pending",
      index: true,
    },
    statusReason: { type: String, trim: true, maxlength: 500, default: "" },
    reviewedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    schemaVersion: { type: Number, default: 2 },
    migrationStatus: { type: String, enum: ["current", "requires-review"], default: "requires-review" },
  },
  { timestamps: true },
);

bookingSchema.index({ caregiverId: 1, startDate: 1, endDate: 1 });
bookingSchema.index({ familyMemberId: 1, createdAt: -1 });
bookingSchema.index({ caregiverId: 1, status: 1, "occurrences.date": 1 });

export const Booking = mongoose.model("Booking", bookingSchema);
