import mongoose from "mongoose";

const familyBookingReservationSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
      index: true,
    },
    familyMemberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    occurrenceDate: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// MongoDB checks this unique index inside the booking transaction. It stops
// two requests from reserving the same family's calendar date concurrently.
familyBookingReservationSchema.index(
  {
    familyMemberId: 1,
    occurrenceDate: 1,
  },
  {
    unique: true,
    name: "unique_active_family_date",
  },
);

export const FamilyBookingReservation = mongoose.model(
  "FamilyBookingReservation",
  familyBookingReservationSchema,
);
