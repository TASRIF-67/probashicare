import mongoose from "mongoose";

export const NOTIFICATION_TYPES = [
  "booking-requested",
  "booking-accepted",
  "booking-declined",
  "booking-cancelled",
  "booking-completed",
  "wellness-report-submitted",
];

export const NOTIFICATION_PRIORITIES = [
  "normal",
  "important",
  "emergency",
];

const notificationSchema = new mongoose.Schema(
  {
    recipientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    priority: {
      type: String,
      enum: NOTIFICATION_PRIORITIES,
      default: "normal",
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    actionPath: {
      type: String,
      trim: true,
      maxlength: 500,
      default: "",
    },
    relatedEntityType: {
      type: String,
      enum: ["booking", "wellness-report"],
      required: true,
    },
    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    eventKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 250,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// This supports recent-first lists and fast unread-count queries.
notificationSchema.index({
  recipientUserId: 1,
  readAt: 1,
  createdAt: -1,
});

// One event can notify many users, but each user receives it only once.
notificationSchema.index(
  {
    recipientUserId: 1,
    eventKey: 1,
  },
  {
    unique: true,
  },
);

export const Notification = mongoose.model(
  "Notification",
  notificationSchema,
);
