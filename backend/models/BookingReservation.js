import mongoose from "mongoose";

const bookingReservationSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
    caregiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    occurrenceDate: { type: Date, required: true },
    minute: { type: Number, min: 0, max: 1439, required: true },
  },
  { timestamps: true },
);

bookingReservationSchema.index(
  { caregiverId: 1, occurrenceDate: 1, minute: 1 },
  { unique: true, name: "unique_active_caregiver_minute" },
);

export const BookingReservation = mongoose.model("BookingReservation", bookingReservationSchema);
