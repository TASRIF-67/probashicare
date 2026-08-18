import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    type: {
      type: String,
      enum: [
        "subscription_expiring",
        "subscription_expired",
        "payment_completed",
        "payment_failed",
        "trial_expiring",
        "booking-requested",
        "booking-accepted",
        "booking-declined",
        "booking-cancelled",
        "booking-completed",
        "wellness-report-submitted",
        "doctor-appointment-assigned",
      ],
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 700 },
    actionUrl: { type: String, default: "/subscription", trim: true },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    dismissedUntil: { type: Date, default: null },
    deduplicationKey: { type: String, required: true, trim: true },
metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    priority: { type: String, default: "normal" },
    actionPath: { type: String, default: "", trim: true },
    relatedEntityType: { type: String, default: "", trim: true },
    relatedEntityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    eventKey: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index(
  { deduplicationKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      deduplicationKey: { $type: "string" },
    },
  },
);

export const Notification = mongoose.model("Notification", notificationSchema);
