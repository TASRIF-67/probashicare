import { Notification } from "../models/Notification.js";

/**
 * Creates one idempotent notification for a user.
 * @param {{recipientUserId: string|import("mongoose").Types.ObjectId, actorUserId?: string|import("mongoose").Types.ObjectId|null, type: string, priority?: "normal"|"important"|"emergency", title: string, message: string, actionPath: string, relatedEntityType: "booking"|"wellness-report", relatedEntityId: string|import("mongoose").Types.ObjectId, eventKey: string, session?: import("mongoose").ClientSession}} input - Notification content and optional transaction.
 * @returns {Promise<import("../models/Notification.js").Notification>} Existing or newly created notification.
 * @sideEffects Upserts one Notification document in MongoDB.
 */
export async function createNotification(input) {
  const filter = {
    recipientUserId: input.recipientUserId,
    eventKey: input.eventKey,
  };

  const values = {
    recipientUserId: input.recipientUserId,
    actorUserId: input.actorUserId || null,
    type: input.type,
    priority: input.priority || "normal",
    title: input.title,
    message: input.message,
    actionPath: input.actionPath,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    eventKey: input.eventKey,
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
 * Creates the same event notification for multiple recipients.
 * @param {{recipientUserIds: Array<string|import("mongoose").Types.ObjectId>, actorUserId?: string|import("mongoose").Types.ObjectId|null, type: string, priority?: "normal"|"important"|"emergency", title: string, message: string, actionPath: string, relatedEntityType: "booking"|"wellness-report", relatedEntityId: string|import("mongoose").Types.ObjectId, eventKey: string, session?: import("mongoose").ClientSession}} input - Shared notification content and recipients.
 * @returns {Promise<void>}
 * @sideEffects Upserts one Notification per unique recipient.
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
