import mongoose from "mongoose";

// This schema stores one in-app message for one recipient. A notification is
// created by another feature, such as booking, wellness, grocery, or payment.
const notificationSchema = new mongoose.Schema(
  {
    // `recipient` is the original field used by list and ownership queries.
    // `ref: "User"` tells Mongoose that the ObjectId points to the User model.
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // `recipientUserId` is kept beside `recipient` for newer producers and
    // backward compatibility with documents created by earlier code.
    recipientUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // The actor is the person whose action caused the notification. It may be
    // null for automatic system events, such as an expiry reminder.
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // `enum` rejects notification types that the application does not know.
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
        "caregiver-review-received",
        "caregiver-complaint-submitted",
        "caregiver-complaint-updated",
        "wellness-report-submitted",
        "grocery-request-submitted",
        "grocery-request-approved",
        "grocery-request-rejected",
        "grocery-purchase-updated",
        "grocery-delivery-updated",
        "doctor-appointment-assigned",
      ],
      required: true,
      index: true,
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
      maxlength: 700,
    },

    // Both URL fields are retained so old subscription notifications and newer
    // workflow notifications can use the same frontend helper.
    actionUrl: {
      type: String,
      default: "/subscription",
      trim: true,
    },
    actionPath: {
      type: String,
      default: "",
      trim: true,
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    dismissedUntil: {
      type: Date,
      default: null,
    },

    // The service builds this as recipient ID + event key. The unique index
    // prevents the same event from producing duplicate messages for one user.
    deduplicationKey: {
      type: String,
      required: true,
      trim: true,
    },

    // Mixed metadata keeps compatibility with notification producers that need
    // extra context without changing the public notification response.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    priority: {
      type: String,
      default: "normal",
    },
    relatedEntityType: {
      type: String,
      default: "",
      trim: true,
    },
    relatedEntityId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    eventKey: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    // `timestamps` automatically adds and maintains `createdAt` and `updatedAt`.
    timestamps: true,
  },
);

// Compound indexes match the two frequent list operations:
// newest notifications for a user, and unread notifications for a user.
notificationSchema.index({
  recipient: 1,
  createdAt: -1,
});
notificationSchema.index({
  recipient: 1,
  isRead: 1,
});

// A partial unique index applies only when `deduplicationKey` is a string. This
// supports legacy documents while preventing concurrent duplicate inserts for
// all current notification producers.
notificationSchema.index(
  {
    deduplicationKey: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      deduplicationKey: {
        $type: "string",
      },
    },
  },
);

// `mongoose.model` connects the schema to the `notifications` collection.
export const Notification = mongoose.model("Notification", notificationSchema);
