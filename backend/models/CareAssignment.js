import mongoose from "mongoose";

export const CARE_ASSIGNMENT_STATUSES = ["scheduled", "active", "completed", "cancelled"];
export const CARE_ASSIGNMENT_TYPES = ["one-time", "scheduled", "long-term"];

const careAssignmentSchema = new mongoose.Schema(
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
    sourceBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    assignmentType: {
      type: String,
      enum: CARE_ASSIGNMENT_TYPES,
      required: true,
    },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, default: null },
    status: {
      type: String,
      enum: CARE_ASSIGNMENT_STATUSES,
      default: "scheduled",
      index: true,
    },
  },
  { timestamps: true },
);

careAssignmentSchema.index({ caregiverUserId: 1, status: 1, startsAt: -1 });
careAssignmentSchema.index({ elderlyProfileId: 1, status: 1, startsAt: -1 });
careAssignmentSchema.index(
  { sourceBookingId: 1 },
  { unique: true, partialFilterExpression: { sourceBookingId: { $type: "objectId" } } },
);

/*
 * Booking owns commercial and scheduling details; this model is the small access
 * projection consumed by reports and emergencies. To add another assignment
 * consumer, use careAssignmentService rather than querying booking collections.
 * A booking controller should call syncCareAssignmentFromBooking whenever a
 * booking is created, rescheduled, completed, or cancelled.
 */
export const CareAssignment = mongoose.model("CareAssignment", careAssignmentSchema);
