import assert from "node:assert/strict";
import test from "node:test";
import {
  dismissNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notificationController.js";
import { Notification } from "../models/Notification.js";

/**
 * Creates a minimal Express-like response that captures JSON.
 * @param {(body: object) => void} saveBody - Callback that stores the body.
 * @returns {{json: (body: object) => void}} Response stub.
 * @sideEffects The json method passes its body to saveBody.
 */
function createResponse(saveBody) {
  return {
    json: (body) => {
      saveBody(body);
    },
  };
}

test("list returns only caller-owned unread records with pagination", async () => {
  const originalFind = Notification.find;
  const originalCountDocuments = Notification.countDocuments;

  const userId = "family-user-id";
  let receivedFindFilter = null;
  let receivedSort = null;
  let receivedSkip = null;
  let receivedLimit = null;
  const receivedCountFilters = [];
  let responseBody = null;

  const fakeNotifications = [
    {
      _id: "notification-1",
      recipient: userId,
      isRead: false,
    },
  ];

  const fakeQuery = {
    sort: (sortValue) => {
      receivedSort = sortValue;
      return fakeQuery;
    },
    skip: (skipValue) => {
      receivedSkip = skipValue;
      return fakeQuery;
    },
    limit: (limitValue) => {
      receivedLimit = limitValue;
      return fakeQuery;
    },
    lean: async () => {
      return fakeNotifications;
    },
  };

  Notification.find = (filter) => {
    receivedFindFilter = filter;
    return fakeQuery;
  };

  Notification.countDocuments = async (filter) => {
    receivedCountFilters.push(filter);

    if (filter.isRead === false) {
      return 2;
    }

    return 5;
  };

  const request = {
    user: {
      _id: userId,
    },
    query: {
      page: "2",
      limit: "3",
      unread: "true",
    },
  };
  const response = createResponse((body) => {
    responseBody = body;
  });

  try {
    await listNotifications(request, response);
  } finally {
    // Restoring monkey-patched methods prevents one test affecting another.
    Notification.find = originalFind;
    Notification.countDocuments = originalCountDocuments;
  }

  assert.deepEqual(receivedFindFilter, {
    recipient: userId,
    isRead: false,
  });
  assert.deepEqual(receivedSort, {
    createdAt: -1,
  });
  assert.equal(receivedSkip, 3);
  assert.equal(receivedLimit, 3);
  assert.deepEqual(receivedCountFilters[0], {
    recipient: userId,
    isRead: false,
  });
  assert.deepEqual(responseBody.data.notifications, fakeNotifications);
  assert.equal(responseBody.data.unreadCount, 2);
  assert.deepEqual(responseBody.data.pagination, {
    page: 2,
    limit: 3,
    total: 2,
    pages: 1,
  });
});

test("mark one read includes recipient ownership in the atomic update", async () => {
  const originalFindOneAndUpdate = Notification.findOneAndUpdate;

  const userId = "family-user-id";
  const notificationId = "notification-id";
  let receivedFilter = null;
  let receivedUpdate = null;
  let receivedOptions = null;
  let responseBody = null;

  const updatedNotification = {
    _id: notificationId,
    recipient: userId,
    isRead: true,
  };

  Notification.findOneAndUpdate = async (filter, update, options) => {
    receivedFilter = filter;
    receivedUpdate = update;
    receivedOptions = options;
    return updatedNotification;
  };

  const request = {
    user: {
      _id: userId,
    },
    params: {
      notificationId,
    },
  };
  const response = createResponse((body) => {
    responseBody = body;
  });

  try {
    await markNotificationRead(request, response);
  } finally {
    Notification.findOneAndUpdate = originalFindOneAndUpdate;
  }

  assert.deepEqual(receivedFilter, {
    _id: notificationId,
    recipient: userId,
  });
  assert.equal(receivedUpdate.$set.isRead, true);
  assert.ok(receivedUpdate.$set.readAt instanceof Date);
  assert.deepEqual(receivedOptions, {
    new: true,
  });
  assert.equal(responseBody.data.notification, updatedNotification);
});

test("mark all read updates only unread notifications owned by caller", async () => {
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
  const response = createResponse((body) => {
    responseBody = body;
  });

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
});

test("dismiss calculates future time and includes recipient ownership", async () => {
  const originalFindOneAndUpdate = Notification.findOneAndUpdate;

  const userId = "family-user-id";
  const notificationId = "notification-id";
  const beforeRequest = Date.now();
  let receivedFilter = null;
  let receivedUpdate = null;

  Notification.findOneAndUpdate = async (filter, update) => {
    receivedFilter = filter;
    receivedUpdate = update;

    return {
      _id: notificationId,
      dismissedUntil: update.$set.dismissedUntil,
    };
  };

  const request = {
    user: {
      _id: userId,
    },
    params: {
      notificationId,
    },
    reminderDismissalHours: 24,
  };
  const response = createResponse(() => {});

  try {
    await dismissNotification(request, response);
  } finally {
    Notification.findOneAndUpdate = originalFindOneAndUpdate;
  }

  const afterRequest = Date.now();
  const expectedDuration = 24 * 60 * 60 * 1000;
  const dismissedTimestamp = receivedUpdate.$set.dismissedUntil.getTime();

  assert.deepEqual(receivedFilter, {
    _id: notificationId,
    recipient: userId,
  });
  assert.ok(dismissedTimestamp >= beforeRequest + expectedDuration);
  assert.ok(dismissedTimestamp <= afterRequest + expectedDuration);
});
