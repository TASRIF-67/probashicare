import mongoose from "mongoose";

export const BOOKING_TYPES = ["one-time", "scheduled", "long-term"];
export const BOOKING_STATUSES = ["pending", "confirmed", "completed", "cancelled"];

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
    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: "pending",
      index: true,
    },
  },
  { timestamps: true },
);

bookingSchema.index({ caregiverId: 1, startDate: 1, endDate: 1 });
bookingSchema.index({ familyMemberId: 1, createdAt: -1 });

export const Booking = mongoose.model("Booking", bookingSchema);
