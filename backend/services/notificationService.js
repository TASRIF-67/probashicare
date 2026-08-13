import { Notification } from "../models/Notification.js";

/**
 * Creates one idempotent booking or wellness notification for a user.
 * @param {{recipientUserId: string|import("mongoose").Types.ObjectId, actorUserId?: string|import("mongoose").Types.ObjectId|null, type: string, priority?: "normal"|"important"|"emergency", title: string, message: string, actionPath: string, relatedEntityType: "booking"|"wellness-report", relatedEntityId: string|import("mongoose").Types.ObjectId, eventKey: string, session?: import("mongoose").ClientSession}} input - Notification content and optional database transaction.
 * @returns {Promise<import("mongoose").Document>} Existing or newly created notification.
 * @sideEffects Upserts one Notification document in MongoDB.
 */
export async function createNotification(input) {
  const filter = {
    deduplicationKey: input.recipientUserId.toString() + ":" + input.eventKey,
  };

  const values = {
    recipient: input.recipientUserId,
    recipientUserId: input.recipientUserId,
    actorUserId: input.actorUserId || null,
    type: input.type,
    title: input.title,
    message: input.message,
    actionUrl: input.actionPath,
    actionPath: input.actionPath,
    priority: input.priority || "normal",
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    eventKey: input.eventKey,
    isRead: false,
    deduplicationKey: filter.deduplicationKey,
    metadata: {
      actorUserId: input.actorUserId || null,
      priority: input.priority || "normal",
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      eventKey: input.eventKey,
    },
  };

  const options = {
    upsert: true,
    new: true,
    runValidators: true,
    setDefaultsOnInsert: true,
  };

  if (input.session) {
    options.session = input.session;
  }

  return Notification.findOneAndUpdate(
    filter,
    {
      $setOnInsert: values,
    },
    options,
  );
}

/**
 * Creates the same event notification for each unique recipient.
 * @param {{recipientUserIds: Array<string|import("mongoose").Types.ObjectId>, actorUserId?: string|import("mongoose").Types.ObjectId|null, type: string, priority?: "normal"|"important"|"emergency", title: string, message: string, actionPath: string, relatedEntityType: "booking"|"wellness-report", relatedEntityId: string|import("mongoose").Types.ObjectId, eventKey: string, session?: import("mongoose").ClientSession}} input - Shared event and recipients.
 * @returns {Promise<void>}
 * @sideEffects Upserts one notification per unique recipient.
 */
export async function createNotificationsForUsers(input) {
  const uniqueRecipientIds = new Set();

  for (const recipientUserId of input.recipientUserIds) {
    uniqueRecipientIds.add(recipientUserId.toString());
  }

  for (const recipientUserId of uniqueRecipientIds) {
    await createNotification({
      ...input,
      recipientUserId,
    });
  }
}
