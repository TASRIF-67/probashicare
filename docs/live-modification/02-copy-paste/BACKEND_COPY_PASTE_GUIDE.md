# Backend Copy-Paste Guide for ProbashiCare Live Modifications

Use this file for Mongoose models, MongoDB queries, Express routes, middleware, controllers, services, external APIs, authentication, and backend tests.

Copy the nearest existing ProbashiCare pattern. Replace placeholder names carefully. Never remove authentication, role checks, ownership filters, Premium checks, or validation to make a request pass.

## Requirement-to-section map

| Requirement | Section |
| --- | --- |
| New schema or field | 2 |
| New route/controller | 3 to 8 |
| Validation | 5 |
| Pagination/filter/search | 6 and 10 |
| Owner/editor/viewer access | 9 |
| Related collection | 10 |
| Safe status change | 11 |
| Duplicate prevention | 12 |
| Two related writes | 13 |
| Notification producer/read action | 14 |
| Gemini/fallback | 15 |
| Acknowledge or resolve wellness alerts | 26 |
| Premium and expiry | 16 |
| Payment or Stripe | 17 and 18 |
| Admin payment analytics/history | 27 |
| Email re-verification | 19 |
| Consume verification token safely | 28 |
| Safe ID/date/error handling | 20 and 21 |
| Tests and verification | 22 and 25 |
| Copilot continuation | 24 |

## 1. Define the API contract first

~~~text
HTTP method:
URL:
Allowed role:
Required ownership/permission:
Params/query/body:
Success status and data:
Expected errors:
Database reads/writes:
~~~

Trace:

~~~text
frontend service
  -> Express route
  -> requireAuth
  -> allowRoles / entitlement
  -> validation
  -> controller
  -> service
  -> Mongoose model
~~~

## 2. Mongoose model

~~~js
import mongoose from "mongoose";

const exampleSchema = new mongoose.Schema(
  {
    familyUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    elderlyProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ElderlyProfile",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    status: {
      type: String,
      enum: [
        "active",
        "archived",
      ],
      default: "active",
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

exampleSchema.index({
  familyUserId: 1,
  status: 1,
  createdAt: -1,
});

export const Example = mongoose.model(
  "Example",
  exampleSchema,
);
~~~

Embedded schema:

~~~js
const medicationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    dosage: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    _id: false,
  },
);
~~~

Use embedded arrays for sections owned by one elderly profile. Use references when records need independent history, permissions, pagination, or indexes.

For concurrency-safe uniqueness:

~~~js
exampleSchema.index(
  {
    dedupeKey: 1,
  },
  {
    unique: true,
  },
);
~~~

## 3. Route and app registration

~~~js
import { Router } from "express";
import {
  createRecord,
  getRecord,
  listRecords,
  updateRecord,
} from "../controllers/exampleController.js";
import {
  allowRoles,
  requireAuth,
} from "../middleware/auth.js";
import { validateExample } from "../middleware/validateExample.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.use(asyncHandler(requireAuth));
router.use(allowRoles("family"));

router.get(
  "/",
  asyncHandler(listRecords),
);

router.post(
  "/",
  validateExample,
  asyncHandler(createRecord),
);

router.get(
  "/:recordId",
  asyncHandler(getRecord),
);

router.patch(
  "/:recordId",
  validateExample,
  asyncHandler(updateRecord),
);

export default router;
~~~

In backend/app.js:

~~~js
import exampleRoutes from "./routes/exampleRoutes.js";

app.use(
  "/api/examples",
  exampleRoutes,
);
~~~

Order is authentication, role/entitlement, validation, controller. Put fixed paths such as /read-all before /:notificationId.

## 4. Standard response shape

~~~js
response.status(201).json({
  success: true,
  data: {
    record,
  },
});
~~~

~~~js
response.json({
  success: true,
  data: {
    records,
    pagination: {
      page,
      limit,
      total,
      pages,
    },
  },
});
~~~

React receives the useful object as response.data.data.

## 5. Validation middleware

~~~js
export function validateExample(
  request,
  _response,
  next,
) {
  const errors = {};
  const title =
    String(request.body.title || "").trim();

  if (!title) {
    errors.title = "Title is required.";
  }

  const allowedStatuses = [
    "active",
    "archived",
  ];

  if (
    request.body.status &&
    !allowedStatuses.includes(request.body.status)
  ) {
    errors.status = "Status is invalid.";
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiError(
      422,
      "Please correct the information.",
      errors,
    );
  }

  request.body.title = title;
  next();
}
~~~

Never accept owner ID, role, plan price, currency, entitlements, verification state, or completed payment state from the browser.

## 6. Authorized list with pagination

~~~js
function readPositiveInteger(
  value,
  fallback,
  maximum,
) {
  const parsedValue =
    Number.parseInt(value, 10);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < 1
  ) {
    return fallback;
  }

  return Math.min(parsedValue, maximum);
}

export async function listRecords(
  request,
  response,
) {
  const page =
    readPositiveInteger(request.query.page, 1, 100000);

  const limit =
    readPositiveInteger(request.query.limit, 3, 50);

  const skip = (page - 1) * limit;
  const filter = {
    familyUserId: request.user._id,
  };

  const status = request.query.status || "active";
  const allowedStatuses = [
    "active",
    "archived",
    "all",
  ];

  if (!allowedStatuses.includes(status)) {
    throw new ApiError(
      422,
      "Status filter is invalid.",
    );
  }

  if (status !== "all") {
    filter.status = status;
  }

  const results = await Promise.all([
    Example.find(filter)
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit)
      .lean(),
    Example.countDocuments(filter),
  ]);

  const records = results[0];
  const total = results[1];
  const pages = Math.max(
    1,
    Math.ceil(total / limit),
  );

  response.json({
    success: true,
    data: {
      records,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    },
  });
}
~~~

lean returns plain objects for display. Promise.all runs independent queries together and returns results in input order.

## 7. Create controller

~~~js
export async function createRecord(
  request,
  response,
) {
  const record = await Example.create({
    familyUserId: request.user._id,
    elderlyProfileId:
      request.body.elderlyProfileId,
    title: request.body.title,
    status: "active",
  });

  response.status(201).json({
    success: true,
    data: {
      record,
    },
  });
}
~~~

Authorize the elderly profile before creating elderly-related data. Derive familyUserId from request.user, never request.body.

## 8. Read, update, and archive with concealed 404

~~~js
export async function getRecord(
  request,
  response,
) {
  const record = await Example.findOne({
    _id: request.params.recordId,
    familyUserId: request.user._id,
  }).lean();

  if (!record) {
    throw new ApiError(
      404,
      "Record not found.",
    );
  }

  response.json({
    success: true,
    data: {
      record,
    },
  });
}
~~~

~~~js
export async function updateRecord(
  request,
  response,
) {
  const record = await Example.findOne({
    _id: request.params.recordId,
    familyUserId: request.user._id,
  });

  if (!record) {
    throw new ApiError(
      404,
      "Record not found.",
    );
  }

  record.title = request.body.title;

  await record.save();

  response.json({
    success: true,
    data: {
      record,
    },
  });
}
~~~

~~~js
const archivedRecord =
  await Example.findOneAndUpdate(
    {
      _id: request.params.recordId,
      familyUserId: request.user._id,
      status: "active",
    },
    {
      $set: {
        status: "archived",
        archivedAt: new Date(),
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );
~~~

A concealed 404 does not reveal that another user owns a private identifier.

## 9. Elderly owner/editor/viewer authorization

Prefer backend/services/elderlyProfileAccessService.js.

General link query:

~~~js
const link = await ElderlyFamilyLink.findOne({
  elderlyProfileId: profileId,
  familyUserId: request.user._id,
  status: "active",
  permission: {
    $in: [
      "owner",
      "editor",
    ],
  },
}).lean();

if (!link) {
  throw new ApiError(
    404,
    "Elderly profile not found.",
  );
}
~~~

Use owner/editor/viewer for reads, owner/editor for edits, and owner for archive/access management. Authorize the parent before querying related wellness, booking, or medical records.

## 10. Related collections, populate, and search

Count:

~~~js
const reportCount =
  await WellnessReport.countDocuments({
    elderlyProfileId: profileId,
    status: "submitted",
  });
~~~

Populate only safe fields:

~~~js
const records = await Notification.find(filter)
  .populate(
    "actorUserId",
    "name role",
  )
  .sort({
    createdAt: -1,
  })
  .lean();
~~~

Do not populate caregiver email into marketplace/public results.

Literal-safe search helper:

~~~js
function escapeRegularExpression(value) {
  const specialCharacters = [
    ".",
    "*",
    "+",
    "?",
    "^",
    "$",
    "{",
    "}",
    "(",
    ")",
    "|",
    "[",
    "]",
    "\\",
  ];

  let escapedValue = "";

  for (const character of value) {
    if (specialCharacters.includes(character)) {
      escapedValue += "\\" + character;
    } else {
      escapedValue += character;
    }
  }

  return escapedValue;
}

const searchText =
  String(request.query.search || "").trim();

if (searchText) {
  filter.title = {
    $regex:
      escapeRegularExpression(searchText),
    $options: "i",
  };
}
~~~

For aggregation examples, see sections 27, 37, 41, and 48 in [COPY_PASTE_PATTERNS.md](COPY_PASTE_PATTERNS.md).

## 11. Atomic status transition

~~~js
const record = await Example.findOneAndUpdate(
  {
    _id: request.params.recordId,
    familyUserId: request.user._id,
    status: "pending",
  },
  {
    $set: {
      status: "accepted",
      acceptedAt: new Date(),
    },
  },
  {
    new: true,
    runValidators: true,
  },
);

if (!record) {
  throw new ApiError(
    409,
    "Only a pending record can be accepted.",
  );
}
~~~

Filtering by the old status prevents two concurrent requests from both completing the transition.

## 12. Idempotent duplicate prevention

~~~js
const record = await Example.findOneAndUpdate(
  {
    dedupeKey,
  },
  {
    $setOnInsert: {
      dedupeKey,
      familyUserId,
      title,
      status: "active",
    },
  },
  {
    upsert: true,
    new: true,
    runValidators: true,
    setDefaultsOnInsert: true,
  },
);
~~~

setOnInsert writes only when upsert creates a document. Pair it with a unique index.

## 13. Transaction for two related writes

~~~js
const session = await mongoose.startSession();

try {
  let result;

  await session.withTransaction(
    async function completeTransaction() {
      const firstRecord =
        await FirstModel.findOneAndUpdate(
          {
            _id: firstId,
            status: "pending",
          },
          {
            $set: {
              status: "completed",
            },
          },
          {
            new: true,
            runValidators: true,
            session,
          },
        );

      if (!firstRecord) {
        throw new ApiError(
          409,
          "Record is no longer pending.",
        );
      }

      const secondRecord =
        await SecondModel.findOneAndUpdate(
          {
            ownerId,
          },
          {
            $set: {
              updatedAt: new Date(),
            },
          },
          {
            new: true,
            upsert: true,
            runValidators: true,
            session,
          },
        );

      result = {
        firstRecord,
        secondRecord,
      };
    },
  );

  return result;
} finally {
  await session.endSession();
}
~~~

Every database operation in the transaction must receive the same session.

## 14. Notifications

Create one event using the existing notification service:

~~~js
await createNotification({
  userId: caregiverUserId,
  actorUserId: request.user._id,
  type: "booking_requested",
  title: "New booking request",
  message: "A family requested care.",
  actionPath: "/caregiver/bookings",
  relatedModel: "Booking",
  relatedId: booking._id,
  eventKey:
    "booking_requested:" +
    booking._id.toString(),
});
~~~

Create for unique users:

~~~js
await createNotificationsForUsers({
  userIds: familyUserIds,
  actorUserId: caregiverUserId,
  type: "wellness_report_submitted",
  title: "Wellness report submitted",
  message: "A caregiver submitted a report.",
  actionPath:
    "/wellness/" +
    elderlyProfileId,
  relatedModel: "WellnessReport",
  relatedId: report._id,
  eventKey:
    "wellness_report_submitted:" +
    report._id.toString(),
});
~~~

Mark all read:

~~~js
const readAt = new Date();

const result = await Notification.updateMany(
  {
    userId: request.user._id,
    readAt: null,
  },
  {
    $set: {
      readAt,
    },
  },
);
~~~

Never omit userId from notification reads or updates. Create the notification only after the business action succeeds, or pass the same transaction session.

## 15. Gemini sanitization, timeout, and fallback

Sanitize:

~~~js
function sanitizeReport(report) {
  return {
    mood: report.mood,
    meals: report.meals,
    medicineIntake: report.medicineIntake,
    bloodPressure: {
      systolic:
        report.vitals?.bloodPressure?.systolic,
      diastolic:
        report.vitals?.bloodPressure?.diastolic,
    },
    bloodSugar:
      report.vitals?.bloodSugar?.value,
    weight:
      report.vitals?.weight?.value,
    observation:
      String(report.healthObservation || "")
        .slice(0, 500),
  };
}
~~~

Exclude names, emails, phones, addresses, contacts, IDs, and unrestricted notes.

Timeout and fallback:

~~~js
async function requestExternalSummary(input) {
  const controller = new AbortController();

  const timeoutId = setTimeout(() => {
    controller.abort();
  }, 12000);

  try {
    const response = await fetch(EXTERNAL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const providerResult =
      await response.json();

    return validateExternalOutput(
      providerResult,
    );
  } catch (_error) {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

const externalResult =
  await requestExternalSummary(sanitizedInput);

let finalResult = externalResult;
let source = "gemini";

if (!finalResult) {
  finalResult =
    buildFallbackWellnessSummary(analysis);

  source = "fallback";
}
~~~

Validate provider JSON, store truthful source, and reuse cached insight when the report signature is unchanged.

## 16. Premium access and expiry

Route:

~~~js
router.post(
  "/elderly/:profileId/insights/generate",
  requireFamilyEntitlement(
    "wellness_insights",
  ),
  asyncHandler(generateInsight),
);
~~~

Effective access:

~~~js
const now = new Date();

if (
  subscription.status === "active" &&
  subscription.currentPeriodEndsAt <= now
) {
  subscription.status = "expired";
  subscription.expiredAt = now;

  await subscription.save();
}

const hasPremiumAccess =
  (
    subscription.status === "active" ||
    subscription.status === "trialing"
  ) &&
  subscription.currentPeriodEndsAt > now;
~~~

Backend access is authoritative. A frontend redirect is not security.

## 17. Subscription and payment authority

Load trusted plan:

~~~js
const plan = await SubscriptionPlan.findOne({
  code: request.body.planCode,
  isActive: true,
}).lean();

if (!plan) {
  throw new ApiError(
    404,
    "Subscription plan not found.",
  );
}
~~~

Snapshot trusted values:

~~~js
const planSnapshot = {
  code: plan.code,
  name: plan.name,
  amount: plan.amount,
  currency: plan.currency,
  duration: plan.duration,
  entitlements: [
    ...plan.entitlements,
  ],
};
~~~

Create pending payment:

~~~js
const payment =
  await SubscriptionPayment.create({
    familyUserId: request.user._id,
    planCode: plan.code,
    planSnapshot,
    paymentMethod:
      request.body.paymentMethod,
    status: "pending",
    transactionReference:
      generatePrototypeTransactionReference(),
  });
~~~

Never take price, currency, duration, or entitlements from React. Grant access only from verified completion. Pending, failed, cancelled, and expired attempts do not grant access. Use section 13 for transactional completion.

## 18. Stripe raw webhook

Mount before express.json:

~~~js
app.use(
  "/api/subscriptions/stripe/webhook",
  express.raw({
    type: "application/json",
  }),
  stripeWebhookRoutes,
);

app.use(express.json());
~~~

Controller:

~~~js
export async function receiveStripeWebhook(
  request,
  response,
) {
  const signature =
    request.headers["stripe-signature"];

  const event =
    constructStripeWebhookEvent(
      request.body,
      signature,
    );

  await processStripeWebhookEvent(event);

  response.json({
    received: true,
  });
}
~~~

Verify raw signature, amount, currency, paid state, metadata, and local pending payment. Make repeated webhooks idempotent. Never complete payment from the browser redirect alone.

## 19. Family email change and token hashing

Normalize and compare:

~~~js
const normalizedEmail =
  String(request.body.email || "")
    .trim()
    .toLowerCase();

const emailChanged =
  normalizedEmail !== request.user.email;
~~~

Confirm password only for identity change:

~~~js
if (emailChanged) {
  const passwordMatches =
    await request.user.comparePassword(
      request.body.currentPassword,
    );

  if (!passwordMatches) {
    throw new ApiError(
      401,
      "Current password is incorrect.",
    );
  }
}
~~~

Hash stored token:

~~~js
const rawToken =
  createVerificationToken();

const tokenHash =
  hashVerificationToken(rawToken);

await EmailVerificationToken.create({
  userId: user._id,
  tokenHash,
  expiresAt: new Date(
    Date.now() + 60 * 60 * 1000,
  ),
});
~~~

Email only the raw token. Store only the hash. After email change, set emailVerified false, invalidate the old session, send verification, clear cookie, and return requiresEmailVerification true.

Consume valid token:

~~~js
const submittedTokenHash =
  hashVerificationToken(
    request.query.token,
  );

const verificationToken =
  await EmailVerificationToken.findOne({
    tokenHash: submittedTokenHash,
    usedAt: null,
    expiresAt: {
      $gt: new Date(),
    },
  });
~~~

Forgot-password and resend responses should remain neutral so email existence is not revealed.

## 20. ObjectId, dates, and ranges

ObjectId middleware:

~~~js
export function validateObjectIdParameter(
  parameterName,
) {
  return function validateObjectId(
    request,
    _response,
    next,
  ) {
    const value =
      request.params[parameterName];

    if (!mongoose.isValidObjectId(value)) {
      throw new ApiError(
        404,
        "Record not found.",
      );
    }

    next();
  };
}
~~~

Date range:

~~~js
const startDate =
  new Date(request.query.startDate);

const endDate =
  new Date(request.query.endDate);

if (
  Number.isNaN(startDate.getTime()) ||
  Number.isNaN(endDate.getTime()) ||
  startDate > endDate
) {
  throw new ApiError(
    422,
    "Enter a valid date range.",
  );
}

filter.createdAt = {
  $gte: startDate,
  $lte: endDate,
};
~~~

Bound number:

~~~js
const hours = Number(request.body.hours);

if (
  !Number.isInteger(hours) ||
  hours < 1 ||
  hours > 168
) {
  throw new ApiError(
    422,
    "Hours must be between 1 and 168.",
  );
}
~~~

## 21. Error status rules

- 400: malformed token or request.
- 401: missing authentication or wrong current password.
- 403: authenticated but wrong role or entitlement.
- 404: missing or concealed unauthorized private resource.
- 409: duplicate or invalid state transition.
- 422: field/query validation.
- 500: unexpected failure.
- 503: configured external provider unavailable when no fallback exists.

Throw ApiError and let asyncHandler/errorHandler send the response. Never send stack traces, database errors, tokens, secrets, or private caregiver email.

## 22. Test templates

Unit helper:

~~~js
import test from "node:test";
import assert from "node:assert/strict";

test(
  "rejects an invalid status",
  function testInvalidStatus() {
    assert.throws(
      () => {
        validateStatus("unknown");
      },
      /invalid/i,
    );
  },
);
~~~

Authenticated MongoDB smoke flow:

~~~text
connect to allowed database
  -> create marker-owned temporary users/data
  -> login through real auth route
  -> call protected endpoint with cookie
  -> verify HTTP response
  -> query MongoDB to verify persistence
  -> verify another user cannot access it
  -> clean only marker-owned fixtures
  -> close server/database in finally
~~~

Cover success, no auth, wrong role, wrong owner, invalid input, empty list, repeated request, and provider failure when relevant.

## 23. Manual MongoDB patterns

Read first:

~~~js
db.examples.find({
  status: "active",
}).limit(3)
~~~

Update exact record:

~~~js
db.examples.updateOne(
  {
    _id: ObjectId("KNOWN_ID"),
  },
  {
    $set: {
      status: "archived",
      archivedAt: new Date(),
    },
  },
)
~~~

Count:

~~~js
db.examples.countDocuments({
  familyUserId:
    ObjectId("KNOWN_USER_ID"),
})
~~~

Always test a filter with find before updateMany or deleteMany.

## 24. Copilot comment-first prompts

~~~js
// Return caller-owned records with page, limit, status filter, and total count.
~~~

~~~js
// Authorize this Family as owner or editor and conceal unauthorized IDs as 404.
~~~

~~~js
// Atomically change pending to accepted and reject every other old status.
~~~

~~~js
// Sanitize wellness values, call Gemini with timeout, and use fallback on failure.
~~~

~~~js
// Create one idempotent notification for every unique Family recipient.
~~~

~~~js
// Complete one pending payment and renew Premium access in one transaction.
~~~

~~~js
// Hash verification token before saving and email only the raw token.
~~~

Verify model names, input source, middleware, ownership, allowed fields, status filter, session, unique index, response shape, and private data before accepting.

## 25. Backend verification

~~~powershell
node --check backend/models/ChangedModel.js
node --check backend/controllers/changedController.js
node --check backend/services/changedService.js
node --check backend/middleware/changedValidation.js
node --check backend/routes/changedRoutes.js
~~~

Relevant tests:

~~~powershell
npm.cmd run test:elderly-profiles --prefix backend
npm.cmd run test:wellness-insights --prefix backend
npm.cmd run test:notifications --prefix backend
npm.cmd run test:subscriptions --prefix backend
npm.cmd run test:auth --prefix backend
~~~

Final:

~~~powershell
git diff --check
git status --short --branch
~~~

If indexes changed:

~~~powershell
npm.cmd run db:sync-indexes --prefix backend
~~~

## Advanced blocks already available

Use [COPY_PASTE_PATTERNS.md](COPY_PASTE_PATTERNS.md) for these longer blocks:

- 21 and 37: related collection and aggregation lookup.
- 23: atomic status transition.
- 24: deduplicated upsert.
- 25: safe date range.
- 27 and 41: dashboard aggregation totals.
- 28: external API timeout/fallback.
- 33: backend unit test.
- 34: manual MongoDB modification.
- 36: two-write transaction.
- 39: notifications for several users.
- 42 to 48: plans, Premium, payments, Stripe, expiry, and Admin history.
- 49 to 55: email change, token hashing, session invalidation, delivery rollback, and smoke tests.

## 26. Wellness-alert status workflow

First authorize the Family/profile relationship. Then use an atomic old-status filter.

Acknowledge only active:

~~~js
const alert =
  await WellnessAlert.findOneAndUpdate(
    {
      _id: alertId,
      elderlyProfileId: profileId,
      status: "active",
    },
    {
      $set: {
        status: "acknowledged",
        acknowledgedAt: new Date(),
        acknowledgedBy: request.user._id,
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

if (!alert) {
  throw new ApiError(
    409,
    "Only an active alert can be acknowledged.",
  );
}
~~~

Resolve active or acknowledged:

~~~js
const alert =
  await WellnessAlert.findOneAndUpdate(
    {
      _id: alertId,
      elderlyProfileId: profileId,
      status: {
        $in: [
          "active",
          "acknowledged",
        ],
      },
    },
    {
      $set: {
        status: "resolved",
        resolvedAt: new Date(),
        resolvedBy: request.user._id,
        resolutionNote:
          request.body.resolutionNote || "",
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );
~~~

Severity comes from wellness analysis rules. Acknowledge/resolve changes workflow state, not medical severity.

## 27. Admin payment history and business analytics

Admin route:

~~~js
router.get(
  "/subscriptions/analytics",
  allowRoles("admin"),
  asyncHandler(getSubscriptionAnalytics),
);
~~~

Totals by payment status:

~~~js
const paymentTotals =
  await SubscriptionPayment.aggregate([
    {
      $group: {
        _id: "$status",
        count: {
          $sum: 1,
        },
        amount: {
          $sum: "$planSnapshot.amount",
        },
      },
    },
    {
      $sort: {
        _id: 1,
      },
    },
  ]);
~~~

Plan performance:

~~~js
const planTotals =
  await SubscriptionPayment.aggregate([
    {
      $match: {
        status: "completed",
      },
    },
    {
      $group: {
        _id: "$planSnapshot.code",
        planName: {
          $first: "$planSnapshot.name",
        },
        payments: {
          $sum: 1,
        },
        revenue: {
          $sum: "$planSnapshot.amount",
        },
      },
    },
    {
      $sort: {
        revenue: -1,
      },
    },
  ]);
~~~

Paginated Admin history:

~~~js
const results = await Promise.all([
  SubscriptionPayment.find(filter)
    .populate(
      "familyUserId",
      "name email",
    )
    .sort({
      createdAt: -1,
    })
    .skip(skip)
    .limit(limit)
    .lean(),
  SubscriptionPayment.countDocuments(filter),
]);

const payments = results[0];
const total = results[1];
~~~

Allow email only in the protected Admin response, never caregiver marketplace output. Validate status/method filters and escape literal search text.

## 28. Verification-token consumption and session invalidation

Consume a token once:

~~~js
const tokenHash =
  hashVerificationToken(
    request.query.token,
  );

const token =
  await EmailVerificationToken.findOneAndUpdate(
    {
      tokenHash,
      usedAt: null,
      expiresAt: {
        $gt: new Date(),
      },
    },
    {
      $set: {
        usedAt: new Date(),
      },
    },
    {
      new: true,
    },
  );

if (!token) {
  throw new ApiError(
    400,
    "Verification link is invalid or expired.",
  );
}

await User.updateOne(
  {
    _id: token.userId,
  },
  {
    $set: {
      emailVerified: true,
    },
  },
);
~~~

For stronger consistency, place token consumption and user verification in one transaction. Password reset should also consume its token once and invalidate existing sessions. Reuse issueVerificationEmail and issuePasswordResetEmail rather than constructing untracked raw tokens in controllers.

## Final explanation

"I changed the Express route and controller. Authentication runs first, followed by role or entitlement and validation. The controller derives ownership from request.user, queries the correct Mongoose model, and returns the standard success/data response. Private resources use concealed 404 behavior. State-sensitive writes use an atomic filter, unique index, or transaction. I tested expected success and failure cases."
