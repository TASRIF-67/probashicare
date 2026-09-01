# Feature 3 - In-app Notification System Full-Stack Guide

# Read this first: one-minute answer

ProbashiCare notifications are **event records stored in MongoDB**. A booking, wellness, grocery, review, appointment, payment, or subscription workflow calls the shared notification service after an important action. The service uses an idempotent upsert so repeating the same event cannot create duplicates. Authenticated users list only documents whose `recipient` equals `request.user._id`. React's `NotificationProvider` polls the unread count every fifteen seconds, while `NotificationBell` loads six recent items on demand and `NotificationsPage` provides paginated history, read actions, and reminder dismissal.

The complete path is:

~~~text
Feature controller completes business action
  -> createNotification or createNotificationsForUsers
  -> Notification.findOneAndUpdate with upsert + unique key
  -> MongoDB notifications collection
  -> GET/PATCH /api/notifications
  -> frontend notificationService
  -> NotificationContext
  -> bell badge/dropdown or full history page
~~~

## Files to open first in a live test

1. `backend/models/Notification.js`
2. `backend/services/notificationService.js`
3. `backend/controllers/notificationController.js`
4. `backend/routes/notificationRoutes.js`
5. the producer controller named in the question
6. `frontend/src/services/notificationService.js`
7. `frontend/src/context/NotificationContext.jsx`
8. `frontend/src/components/notifications/NotificationBell.jsx`
9. `frontend/src/pages/NotificationsPage.jsx`
10. `backend/scripts/smokeNotifications.js`

# 1. Functional requirement

Families and caregivers receive in-app notifications for booking requests, status changes, cancellations, completed visits, and submitted wellness reports. The bell shows the unread number and links each notification to the related page.

The implemented shared system also supports grocery, caregiver feedback/complaints, doctor appointments, payment, trial, and subscription events.

# 2. Responsibility map

## Backend

| File | Responsibility |
| --- | --- |
| `models/Notification.js` | document fields, allowed types, timestamps, and indexes |
| `services/notificationService.js` | one-user and multi-user idempotent creation |
| `controllers/notificationController.js` | list, mark one read, mark all read, dismiss |
| `routes/notificationRoutes.js` | authenticated endpoint and middleware order |
| producer controllers | decide when, who, title/message, action path, and event key |
| `test/notificationController.test.js` | isolated controller behavior |
| `scripts/smokeNotifications.js` | real auth + Express + MongoDB verification |

## Frontend

| File | Responsibility |
| --- | --- |
| `services/notificationService.js` | Axios HTTP calls |
| `context/NotificationContext.jsx` | shared recent list, unread count, polling, actions |
| `components/notifications/NotificationBell.jsx` | badge and six-item dropdown |
| `pages/NotificationsPage.jsx` | three-per-page history and controls |
| `utils/notificationHelpers.js` | safe route and reminder checks |
| `styles/notifications.css` | dropdown and history presentation |
| `main.jsx` | mounts NotificationProvider |
| `App.jsx` | family/caregiver notification routes |
| header components | display NotificationBell |

# 3. Database design

## 3.1 Important fields

~~~js
{
  recipient: ObjectId,
  recipientUserId: ObjectId,
  actorUserId: ObjectId | null,
  type: String,
  title: String,
  message: String,
  actionUrl: String,
  actionPath: String,
  isRead: Boolean,
  readAt: Date | null,
  dismissedUntil: Date | null,
  deduplicationKey: String,
  priority: String,
  relatedEntityType: String,
  relatedEntityId: ObjectId | null,
  eventKey: String,
  metadata: Object,
  createdAt: Date,
  updatedAt: Date
}
~~~

### recipient and recipientUserId

`recipient` is the original ownership field used by list/read queries. `recipientUserId` is retained for newer producer compatibility. Current creation writes both.

This is a legacy compatibility design. Do not remove either field during a live test without a migration and updates to all queries.

### actorUserId

The actor caused the event. For example:

- family sends booking request -> actor is family,
- caregiver accepts -> actor is caregiver,
- automatic subscription reminder -> actor may be null.

The recipient is the person who sees the message; the actor is not the owner.

### actionPath and actionUrl

New workflow notifications use `actionPath`. Older subscription records may use `actionUrl`. The frontend helper checks both, then uses a role-safe notification-page fallback.

### relatedEntity fields

These identify the business record behind the message, such as a booking or wellness report. They make later filtering or navigation possible without exposing unrelated private data.

## 3.2 Indexes

~~~js
notificationSchema.index({
  recipient: 1,
  createdAt: -1,
});

notificationSchema.index({
  recipient: 1,
  isRead: 1,
});

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
~~~

- first: list one user's newest messages,
- second: count/list one user's unread messages,
- third: prevent concurrent duplicate event creation,
- partial expression: permit old documents that did not have the current key shape.

A normal controller check is not sufficient for duplicate prevention because two requests can both check before either inserts. The unique database index is the final concurrency protection.

# 4. Notification creation logic

## 4.1 One recipient

The producer passes business meaning:

~~~js
await createNotification({
  recipientUserId: caregiverUserId,
  actorUserId: familyUserId,
  type: "booking-requested",
  priority: "important",
  title: "New booking request",
  message: "A family requested a companionship visit.",
  actionPath: "/caregiver/bookings",
  relatedEntityType: "BookingReservation",
  relatedEntityId: booking._id,
  eventKey: "booking-requested:" + booking._id,
  session,
});
~~~

The service adds recipient identity:

~~~js
const recipientIdText =
  input.recipientUserId.toString();

const deduplicationKey =
  recipientIdText + ":" + input.eventKey;
~~~

Read it from right to left:

1. `input.recipientUserId` reads a property from the input object.
2. `.toString()` calls the ID's conversion method.
3. `input.eventKey` reads the logical event identity.
4. `+` joins recipient, colon, and event.
5. `const deduplicationKey =` stores the result.

## 4.2 Idempotent upsert

~~~js
return Notification.findOneAndUpdate(
  {
    deduplicationKey,
  },
  {
    $setOnInsert: valuesForNewDocument,
  },
  {
    upsert: true,
    new: true,
    runValidators: true,
    setDefaultsOnInsert: true,
    session,
  },
);
~~~

- `findOneAndUpdate` searches and atomically updates.
- `upsert` inserts if missing.
- `$setOnInsert` applies only to a new insert.
- repeating the same event returns the original record,
- an already-read repeated notification does not become unread again,
- `session` joins the caller's transaction when supplied.

## 4.3 Several recipients

~~~js
const uniqueRecipientIds = new Set();

for (const recipientUserId of input.recipientUserIds) {
  uniqueRecipientIds.add(
    recipientUserId.toString(),
  );
}

for (const recipientUserId of uniqueRecipientIds) {
  await createNotification({
    ...input,
    recipientUserId,
  });
}
~~~

`Set` keeps unique strings. Object spread copies shared values. The later `recipientUserId` replaces a same-named copied property. Sequential `await` is simple to trace and avoids a large database burst.

# 5. Producer workflow

A notification should describe a business event that already succeeded.

## Good order without a transaction

~~~text
validate permission
-> update booking/report
-> save successful business result
-> create notification
-> send response
~~~

If notification creation fails after the business save, the action may still be complete while notification delivery fails. Whether to treat that as fatal is a business decision.

## Strong order with a transaction

~~~text
start session
-> transaction callback
   -> change business record with session
   -> create notification with same session
-> commit
-> response
~~~

Then both writes commit or both roll back.

## Current producer locations

Use this search:

~~~powershell
rg -n "createNotification|createNotificationsForUsers" backend/controllers
~~~

Important producers include:

- `bookingWorkflowController.js`
- `wellnessReportController.js`
- `doctorAppointmentController.js`
- `groceryRequestController.js`
- `caregiverFeedbackController.js`
- subscription/payment services

# 6. Backend API contract

Every route first passes `requireAuth`. The route does not accept a recipient ID; controllers derive it from the verified session.

## 6.1 List

~~~text
GET /api/notifications?page=1&limit=3
GET /api/notifications?page=1&limit=3&unread=true
Auth: any verified authenticated user
~~~

Success:

~~~json
{
  "success": true,
  "data": {
    "notifications": [],
    "unreadCount": 2,
    "pagination": {
      "page": 1,
      "limit": 3,
      "total": 7,
      "pages": 3
    }
  }
}
~~~

`total` follows the active list filter. `unreadCount` always reports all unread messages for the bell.

Controller filter:

~~~js
const filter = {
  recipient: request.user._id,
};

if (request.query.unread === "true") {
  filter.isRead = false;
}
~~~

Three independent queries run through `Promise.all`:

1. page records,
2. all unread count,
3. filtered total for pagination.

`lean` returns plain objects because no document methods are needed.

## 6.2 Mark one read

~~~text
PATCH /api/notifications/:notificationId/read
~~~

Atomic ownership filter:

~~~js
{
  _id: request.params.notificationId,
  recipient: request.user._id
}
~~~

Update:

~~~js
{
  $set: {
    isRead: true,
    readAt: new Date()
  }
}
~~~

A missing ID and another user's ID both return 404. This prevents record-existence leakage.

## 6.3 Mark all read

~~~text
PATCH /api/notifications/read-all
~~~

~~~js
await Notification.updateMany(
  {
    recipient: request.user._id,
    isRead: false,
  },
  {
    $set: {
      isRead: true,
      readAt,
    },
  },
);
~~~

`updateMany` performs one database operation. The same `readAt` Date is used for every changed document.

## 6.4 Dismiss reminder

~~~text
PATCH /api/notifications/:notificationId/dismiss
Body: { "hours": 24 }
~~~

Validation middleware verifies hours and stores the normalized value on `request.reminderDismissalHours`. The controller converts hours to milliseconds:

~~~js
const milliseconds =
  hours * 60 * 60 * 1000;

const dismissedUntil =
  new Date(Date.now() + milliseconds);
~~~

Dismissal does not delete the record and does not mark it read.

# 7. Route order and middleware

~~~js
router.use(asyncHandler(requireAuth));

router.get("/", asyncHandler(listNotifications));

router.patch(
  "/read-all",
  asyncHandler(markAllNotificationsRead),
);

router.patch(
  "/:notificationId/read",
  validateSubscriptionObjectId("notificationId"),
  asyncHandler(markNotificationRead),
);
~~~

Why fixed `/read-all` comes first: otherwise a dynamic route could treat "read-all" as `notificationId`.

Why `asyncHandler` exists: Express needs rejected controller Promises forwarded to the shared error middleware.

# 8. Frontend service

The frontend service keeps Axios details outside JSX.

~~~js
const response = await api.get(
  "/notifications",
  {
    params: {
      page: 1,
      limit: 3,
      unread: true,
    },
  },
);

return response.data.data;
~~~

Response levels:

1. `response`: Axios response object,
2. `response.data`: backend JSON body,
3. `response.data.data`: ProbashiCare feature payload,
4. `response.data.data.notifications`: array.

# 9. NotificationContext

## 9.1 Why context is used

The unread count is needed in multiple headers, the dropdown, and actions. Context creates one shared client-side source instead of each header maintaining a separate count.

Provider value:

~~~js
{
  notifications,
  unreadCount,
  isLoading,
  error,
  loadNotifications,
  refreshUnreadCount,
  markAsRead,
  markAllAsRead
}
~~~

`useNotifications()` returns exactly that object and throws when used outside `NotificationProvider`.

## 9.2 Polling

~~~js
useEffect(() => {
  if (!user) {
    setNotifications([]);
    setUnreadCount(0);
    return undefined;
  }

  refreshUnreadCount();

  const intervalId = window.setInterval(
    refreshUnreadCount,
    15000,
  );

  return function stopPolling() {
    window.clearInterval(intervalId);
  };
}, [refreshUnreadCount, user]);
~~~

- immediate refresh after login/user change,
- repeat every fifteen seconds,
- cleanup prevents duplicate timers,
- a background polling failure stays silent,
- effect callback is not async.

Polling is not true real-time delivery. WebSocket or Server-Sent Events could push instantly, but polling is simpler and sufficient for this project.

## 9.3 useCallback

`refreshUnreadCount` and `loadNotifications` use `useCallback` so their identity changes only when the authenticated user changes. This keeps the effect dependency stable.

## 9.4 useMemo

The provider uses `useMemo` for the context object. Without it, a new object would be created on every provider render and all consumers could rerender even when their data did not change.

## 9.5 Functional state update

~~~js
setNotifications((currentNotifications) => {
  const updated = [];

  for (const notification of currentNotifications) {
    if (notification._id === notificationId) {
      updated.push(updatedNotification);
    } else {
      updated.push(notification);
    }
  }

  return updated;
});
~~~

The callback receives the latest array, preventing stale-state bugs when actions finish close together.

# 10. Notification bell

When opened:

~~~js
await loadNotifications({
  page: 1,
  limit: 6,
});
~~~

The bell:

- shows unread count, capped visually at 99+,
- loads only six recent records,
- closes on outside click,
- closes on Escape,
- removes document listeners on unmount,
- marks an unread item before navigation,
- links to full history,
- exposes "mark all read".

`useRef` points to the bell DOM root. `element.contains(event.target)` tells whether a click occurred inside it.

# 11. Full history page

The page uses:

- page size 3,
- all/unread filter,
- loading state,
- normalized API error,
- empty state,
- mark one,
- mark all,
- reminder dismissal,
- related-page navigation,
- Pagination component.

When the filter changes, it resets to page 1. If the current page becomes larger than the last valid page, it changes to the last valid page and reloads.

# 12. Privacy and authorization

The central rule is:

~~~js
recipient: request.user._id
~~~

Never implement this:

~~~js
recipient: request.query.userId
~~~

A logged-in user could supply someone else's ID.

Titles/messages must not include unnecessary medical detail. For a wellness event, notify that a report was submitted and link to the authorized page; do not copy unrestricted private notes into the notification.

A frontend hidden button is not security. Backend ownership queries remain mandatory.

# 13. Error handling

## Backend

- malformed ObjectId -> validation middleware,
- missing/other-user notification -> concealed 404,
- invalid dismissal hours -> 422 validation error,
- duplicate event -> unique index plus upsert prevents duplicate,
- unexpected database error -> asyncHandler -> shared error handler.

## Frontend

- dropdown load failure -> toast,
- page load failure -> visible alert,
- mutation failure -> toast,
- polling failure -> silent, because it is background work,
- `finally` clears busy/loading state.

# 14. Concurrency and correctness

## Duplicate creation race

Two requests can call create with the same event simultaneously. Both use the same deduplication filter; the unique index ensures only one logical notification exists.

## Read race

Setting `isRead: true` is idempotent. Repeating it has the same final result.

## Unread count race

The client may temporarily show a stale count until the next refresh. After mutations it explicitly refreshes or updates local state. MongoDB remains the source of truth.

## Transaction boundary

Passing `session` makes notification creation part of a producer transaction. Omitting it means the notification is a separate write.

# 15. Authenticated MongoDB smoke test

Run:

~~~powershell
npm.cmd run test:notifications:integration --prefix backend
~~~

The script:

1. connects to the configured learning database,
2. starts Express on a random local port,
3. creates two verified temporary families,
4. logs both in through the real auth endpoint,
5. creates one notification twice and verifies one document,
6. lists as the owner,
7. confirms the other user receives 404,
8. marks one read,
9. marks all read,
10. confirms zero unread,
11. deletes only marker-owned fixtures,
12. closes server and MongoDB in `finally`.

This is stronger than a helper unit test because it verifies cookie auth, route mounting, middleware, controller, service, indexes, and MongoDB together.

# 16. Live modification example: filter by type

Question: "Let users show only booking notifications."

## Step 1: contract

~~~text
GET /api/notifications?type=booking-requested
~~~

## Step 2: allowlist

Do not accept arbitrary types blindly:

~~~js
const allowedTypes = [
  "booking-requested",
  "booking-accepted",
  "booking-declined",
  "booking-cancelled",
  "booking-completed",
];

const requestedType = request.query.type;

if (
  requestedType &&
  !allowedTypes.includes(requestedType)
) {
  throw new ApiError(
    422,
    "Notification type is invalid.",
  );
}
~~~

## Step 3: add filter

~~~js
const filter = {
  recipient: request.user._id,
};

if (requestedType) {
  filter.type = requestedType;
}
~~~

The same filter must be used for page records and filtered total. The global unread count can remain owner-only if the UI badge should show all unread messages.

## Step 4: frontend service

No method change is needed because Axios already serializes the params object:

~~~js
notificationService.list({
  page: 1,
  limit: 3,
  type: "booking-requested",
});
~~~

## Step 5: page state

~~~jsx
const [typeFilter, setTypeFilter] =
  useState("");

const params = {
  page,
  limit: PAGE_SIZE,
};

if (typeFilter) {
  params.type = typeFilter;
}
~~~

Reset page to 1 when the filter changes.

## Step 6: test

Assert that the filter passed to `Notification.find` contains both:

~~~js
{
  recipient: userId,
  type: "booking-requested"
}
~~~

This example changes query, controller, service usage, React state, and tests without changing schema.

# 17. Live modification example: type totals dashboard

Question: "Show how many unread booking and wellness notifications exist."

~~~js
const totals = await Notification.aggregate([
  {
    $match: {
      recipient: request.user._id,
      isRead: false,
    },
  },
  {
    $group: {
      _id: "$type",
      count: {
        $sum: 1,
      },
    },
  },
  {
    $sort: {
      count: -1,
    },
  },
]);
~~~

If `request.user._id` is not already an ObjectId in a different context:

~~~js
const userObjectId =
  new mongoose.Types.ObjectId(userId);
~~~

In this app, `request.user._id` comes from a Mongoose User document and is already an ObjectId.

# 18. Live modification example: add a new event

Question: "Notify family when a doctor appointment is cancelled."

1. Add the type to the schema enum:
   `doctor-appointment-cancelled`.
2. Find the successful cancellation point in the appointment controller.
3. Find authorized family recipient IDs.
4. Call `createNotificationsForUsers`.
5. Use a stable event key:
   `"doctor-appointment-cancelled:" + appointment._id`.
6. Use a family-safe action path.
7. Add a producer test.
8. Run index/test/build verification.

Producer block:

~~~js
await createNotificationsForUsers({
  recipientUserIds: familyUserIds,
  actorUserId: request.user._id,
  type: "doctor-appointment-cancelled",
  priority: "important",
  title: "Doctor appointment cancelled",
  message:
    "A scheduled doctor appointment was cancelled.",
  actionPath: "/doctor-visits",
  relatedEntityType: "DoctorAppointment",
  relatedEntityId: appointment._id,
  eventKey:
    "doctor-appointment-cancelled:" +
    appointment._id,
});
~~~

# 19. Manual MongoDB practice

Read current user's newest notifications:

~~~js
db.notifications
  .find({
    recipient: ObjectId("USER_ID"),
  })
  .sort({
    createdAt: -1,
  })
  .limit(3);
~~~

Count unread:

~~~js
db.notifications.countDocuments({
  recipient: ObjectId("USER_ID"),
  isRead: false,
});
~~~

Mark all read:

~~~js
db.notifications.updateMany(
  {
    recipient: ObjectId("USER_ID"),
    isRead: false,
  },
  {
    $set: {
      isRead: true,
      readAt: new Date(),
    },
  },
);
~~~

Group unread by type:

~~~js
db.notifications.aggregate([
  {
    $match: {
      recipient: ObjectId("USER_ID"),
      isRead: false,
    },
  },
  {
    $group: {
      _id: "$type",
      count: {
        $sum: 1,
      },
    },
  },
]);
~~~

Always use a known test user ID and a narrow filter before a manual update.

# 20. Common mistakes

1. Trusting recipient ID from body/query.
2. Forgetting authentication middleware.
3. Using `create` without a unique idempotency key.
4. Changing enum without updating producers/tests.
5. Reusing the same event key for different logical events.
6. Omitting session inside a transaction.
7. Declaring `/:id` before a fixed route.
8. Returning all notifications without pagination.
9. Using `useEffect(async () => ...)`.
10. Forgetting interval/listener cleanup.
11. Decreasing unread count below zero.
12. Navigating to an external/untrusted URL.
13. Showing private health details in message text.
14. Hiding UI without enforcing backend ownership.
15. Deleting notification history when "dismiss" should be temporary.

# 21. Viva questions and answers

## What does createContext do?

It creates a React channel through which a provider supplies a value to descendant consumers without manual prop passing.

## What does useNotifications return?

The current context object: notification records, unread count, loading/error state, and functions to load/refresh/mark records.

## Where is the notification actually generated?

In the backend producer workflow. It calls `createNotification` or `createNotificationsForUsers`, which upserts a Notification document.

## Why store notifications in MongoDB?

They survive refresh/login, support history/pagination/read state, and allow several devices to share the same server truth.

## Why both an application check and unique index?

Application logic creates the correct key; the unique index prevents concurrency races at the database level.

## Why is recipient in every controller query?

It is resource-level authorization. A valid notification ID alone must not grant access.

## Why polling?

It is simpler than WebSocket infrastructure. The unread count becomes eventually consistent within fifteen seconds and refreshes after mutations.

## Why use lean?

The list only serializes results. Plain objects avoid unnecessary Mongoose document behavior.

## Why Promise.all?

The list, unread count, and total queries are independent, so they can run concurrently. Result order matches input order.

## What is a concealed 404?

Both nonexistent and unauthorized resource IDs return the same not-found response so attackers cannot discover another user's records.

## What is the difference between read and dismiss?

Read records that the user saw an item. Dismiss postpones a reminder until a time. Neither deletes the historical document.

## How would you make it truly real-time?

Publish server events through WebSocket or Server-Sent Events after persistent creation, authenticate each connection, and keep MongoDB as history/source of truth.

# 22. Verification commands

~~~powershell
node --check backend/models/Notification.js
node --check backend/services/notificationService.js
node --check backend/controllers/notificationController.js
node --check backend/routes/notificationRoutes.js
node --check backend/scripts/smokeNotifications.js

npm.cmd run test:notifications --prefix backend
npm.cmd run test:notifications:integration --prefix backend
node --test backend/test
npm.cmd run build --prefix frontend
git diff --check
git status --short --branch
~~~

# 23. Thirty-second final explanation

"An authorized workflow calls the shared service with recipient, event type, route, related record, and a stable event key. The service combines recipient and event key and performs a `$setOnInsert` upsert protected by a unique index, so delivery is idempotent even under concurrency. Authenticated notification endpoints always filter by `request.user._id` and support pagination, single/bulk read, and reminder dismissal. On the frontend, a context polls the unread count, the bell loads recent messages, and a separate page loads paginated history. Owner-isolation unit tests and an authenticated MongoDB smoke test verify the complete flow."