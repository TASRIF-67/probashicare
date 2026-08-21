import assert from "node:assert/strict";
import test from "node:test";
import { Notification } from "../models/Notification.js";
import { markAllNotificationsRead } from "../controllers/notificationController.js";

test(
  "mark all read updates only unread notifications owned by the caller",
  async () => {
    const originalUpdateMany = Notification.updateMany;
    const userId = "family-user-id";
    let receivedFilter = null;
    let receivedUpdate = null;
    let responseBody = null;

    Notification.updateMany = async (filter, update) => {
      receivedFilter = filter;
      receivedUpdate = update;

      return {
        modifiedCount: 4,
      };
    };

    const request = {
      user: {
        _id: userId,
      },
    };
    const response = {
      /**
       * Captures the controller response.
       * @param {object} body - JSON response body.
       * @returns {void}
       * @sideEffects Saves the body for assertions.
       */
      json(body) {
        responseBody = body;
      },
    };

    try {
      await markAllNotificationsRead(request, response);
    } finally {
      Notification.updateMany = originalUpdateMany;
    }

    assert.deepEqual(receivedFilter, {
      recipient: userId,
      isRead: false,
    });
    assert.equal(receivedUpdate.$set.isRead, true);
    assert.ok(receivedUpdate.$set.readAt instanceof Date);
    assert.equal(responseBody.data.modifiedCount, 4);
    assert.equal(responseBody.data.unreadCount, 0);
  },
);
