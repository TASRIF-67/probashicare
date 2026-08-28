import { Notification } from "../models/Notification.js";

/**
 * Creates one idempotent notification for one user.
 * @param {{
 *   recipientUserId: string|import("mongoose").Types.ObjectId,
 *   actorUserId?: string|import("mongoose").Types.ObjectId|null,
 *   type: string,
 *   priority?: "normal"|"important"|"emergency",
 *   title: string,
 *   message: string,
 *   actionPath: string,
 *   relatedEntityType: string,
 *   relatedEntityId: string|import("mongoose").Types.ObjectId,
 *   eventKey: string,
 *   session?: import("mongoose").ClientSession
 * }} input - Notification content and optional MongoDB transaction session.
 * @returns {Promise<import("mongoose").Document>} The existing or newly inserted Notification document.
 * @sideEffects Upserts one Notification document in MongoDB.
 */
export async function createNotification(input) {
  // `toString()` converts either a string ID or Mongoose ObjectId into the same
  // text format. Joining it with `eventKey` creates a per-user event identity.
  const recipientIdText = input.recipientUserId.toString();
  const deduplicationKey = recipientIdText + ":" + input.eventKey;

  const filter = {
    deduplicationKey,
  };

  const actorUserId = input.actorUserId || null;
  const priority = input.priority || "normal";

  const valuesForNewDocument = {
    recipient: input.recipientUserId,
    recipientUserId: input.recipientUserId,
    actorUserId,
    type: input.type,
    title: input.title,
    message: input.message,
    actionUrl: input.actionPath,
    actionPath: input.actionPath,
    priority,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    eventKey: input.eventKey,
    isRead: false,
    deduplicationKey,
    metadata: {
      actorUserId,
      priority,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      eventKey: input.eventKey,
    },
  };

  const queryOptions = {
    // `upsert` inserts when no matching deduplication key exists.
    upsert: true,
    // `new` returns the document after the update instead of the old value.
    new: true,
    // `runValidators` applies schema rules to update values.
    runValidators: true,
    // `setDefaultsOnInsert` applies schema defaults during an upsert insert.
    setDefaultsOnInsert: true,
  };

  if (input.session) {
    // A producer can pass its transaction session so the business action and
    // notification either both commit or both roll back.
    queryOptions.session = input.session;
  }

  const update = {
    // `$setOnInsert` writes values only when this upsert creates a document.
    // Repeating the same event therefore returns the original notification
    // without changing its read status or creation time.
    $setOnInsert: valuesForNewDocument,
  };

  // Returning the Mongoose Query is valid because it is awaitable like a
  // Promise. The caller can use `await createNotification(...)`.
  return Notification.findOneAndUpdate(filter, update, queryOptions);
}

/**
 * Creates the same event notification for each unique recipient.
 * @param {{
 *   recipientUserIds: Array<string|import("mongoose").Types.ObjectId>,
 *   actorUserId?: string|import("mongoose").Types.ObjectId|null,
 *   type: string,
 *   priority?: "normal"|"important"|"emergency",
 *   title: string,
 *   message: string,
 *   actionPath: string,
 *   relatedEntityType: string,
 *   relatedEntityId: string|import("mongoose").Types.ObjectId,
 *   eventKey: string,
 *   session?: import("mongoose").ClientSession
 * }} input - Shared event data and recipient identifiers.
 * @returns {Promise<void>} Resolves after every unique recipient is processed.
 * @sideEffects Upserts one notification per unique recipient in MongoDB.
 */
export async function createNotificationsForUsers(input) {
  // `Set` stores only unique values. Adding the same user ID twice keeps one
  // value, so one family member cannot receive duplicate copies of an event.
  const uniqueRecipientIds = new Set();

  for (const recipientUserId of input.recipientUserIds) {
    // ObjectIds are converted to strings so equal IDs compare as equal values.
    const recipientIdText = recipientUserId.toString();
    uniqueRecipientIds.add(recipientIdText);
  }

  for (const recipientUserId of uniqueRecipientIds) {
    // Object spread copies the shared event fields. The later
    // `recipientUserId` property replaces any copied property with that name.
    const notificationInput = {
      ...input,
      recipientUserId,
    };

    // The loop intentionally awaits each operation. This is easier to trace,
    // preserves a shared transaction session, and avoids a sudden query burst.
    await createNotification(notificationInput);
  }
}
