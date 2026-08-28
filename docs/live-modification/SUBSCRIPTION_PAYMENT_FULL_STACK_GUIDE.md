# Feature 4: Subscription, Premium Access, Payments, and Admin Analytics

This is the complete study guide for the fourth assigned ProbashiCare feature.

> Family members can select subscription plans, complete simulated or Stripe sandbox payments, receive transaction references, activate or renew Premium access, review paginated payment history, and administrators can monitor payments and business analytics.

# Part A - Read this first

## A1. One-minute viva answer

ProbashiCare keeps three different database responsibilities separate:

1. `SubscriptionPlan` is the current product catalog controlled by the backend.
2. `FamilySubscription` is one family's current access state, trial history, plan snapshot, activation time, and exact expiry.
3. `SubscriptionPayment` is an immutable-style history of each payment attempt, including its own price and plan snapshot.

The frontend never decides the amount or duration. It sends only a plan code and payment method. The backend reloads the active plan, copies an authoritative snapshot into the payment, and creates a pending record with a unique transaction reference.

For prototype payments, an explicit test endpoint marks the pending payment successful. For Stripe, only a valid signed webhook can confirm success. The completion service updates the payment and subscription inside a MongoDB transaction. Repeated confirmations are idempotent, so they do not extend access twice.

Premium authorization is enforced by backend middleware. A frontend upgrade modal is only user guidance and is not security.

## A2. Most important files

### Backend

- `backend/config/subscriptionPlans.js` - backend-controlled plan definitions.
- `backend/models/SubscriptionPlan.js` - catalog schema.
- `backend/models/FamilySubscription.js` - one current access record per Family.
- `backend/models/SubscriptionPayment.js` - payment and transaction history.
- `backend/services/subscriptionService.js` - trial, access, and expiry.
- `backend/services/entitlementService.js` - calculates effective Core/Premium access.
- `backend/services/prototypePaymentService.js` - simulated payment lifecycle.
- `backend/services/stripePaymentService.js` - Stripe Checkout and webhook logic.
- `backend/services/subscriptionReminderService.js` - expiry reminder thresholds.
- `backend/middleware/requireFamilyEntitlement.js` - real Premium authorization.
- `backend/controllers/subscriptionController.js` - Family HTTP handlers.
- `backend/controllers/adminSubscriptionController.js` - analytics and history.
- `backend/routes/subscriptionRoutes.js` - authenticated Family routes.
- `backend/app.js` - raw Stripe webhook mounting before JSON parsing.
- `backend/scripts/smokeSubscriptions.js` - authenticated MongoDB workflow test.

### Frontend

- `frontend/src/services/subscriptionService.js` - HTTP calls.
- `frontend/src/context/SubscriptionContext.jsx` - shared current access.
- `frontend/src/pages/family/FamilySubscriptionPage.jsx` - plan, checkout, and history UI.
- `frontend/src/components/subscription/CurrentSubscriptionCard.jsx` - exact activation/expiry.
- `frontend/src/components/subscription/PremiumFeatureGate.jsx` - upgrade guidance.
- `frontend/src/pages/admin/AdminSubscriptionPaymentsPage.jsx` - transaction audit.
- `frontend/src/components/admin/AdminBusinessAnalytics.jsx` - business totals.

## A3. End-to-end prototype payment flow

~~~text
FamilySubscriptionPage
  -> subscriptionService.purchase({ planCode, paymentMethod })
  -> POST /api/subscriptions/purchase
  -> requireAuth
  -> allowRoles("family")
  -> validateSubscriptionPurchase
  -> purchaseSubscription controller
  -> createPrototypePayment
       -> require prototype mode
       -> load active SubscriptionPlan by code
       -> copy authoritative plan snapshot
       -> create pending SubscriptionPayment
       -> generate DEV transaction reference
  <- 201 { payment }

Family clicks "Simulate success"
  -> POST /api/subscriptions/payments/:paymentId/simulate-success
  -> completePrototypePayment
       -> ownership query includes family ID
       -> start MongoDB transaction
       -> atomically change pending payment to completed
       -> activate or renew FamilySubscription
       -> save exact currentPeriodEndsAt
       -> create confirmation reference and notification
  <- completed payment + subscription + access
~~~

## A4. End-to-end Stripe sandbox flow

~~~text
Family chooses plan
  -> POST /api/subscriptions/stripe/checkout
  -> backend loads authoritative plan
  -> backend creates pending SubscriptionPayment
  -> backend creates Stripe hosted Checkout Session
  <- checkoutUrl
  -> browser navigates to Stripe

Stripe completes checkout
  -> Stripe POSTs a signed event to
     /api/subscriptions/stripe/webhook
  -> express.raw keeps the exact signed bytes
  -> constructStripeWebhookEvent verifies Stripe-Signature
  -> validate amount, currency, status, metadata, and local payment
  -> MongoDB transaction completes payment and activates access
  -> duplicate event safely returns the existing completion

Browser returns to /subscription?stripe=success&session_id=...
  -> page polls the caller-owned local payment briefly
  -> refreshes subscription/access/history
~~~

The browser redirect is not proof of payment. The signed webhook is proof.

## A5. The five rules to memorize

1. Never trust price, currency, duration, entitlements, family ID, or status from the frontend.
2. Put ownership inside the MongoDB query.
3. Change pending-to-completed atomically and make repeated confirmations idempotent.
4. Verify Stripe's raw signed request before processing it.
5. Enforce Premium on the backend even when the frontend already hides the action.

# Part B - Data design

## B1. SubscriptionPlan

The plan model represents the current catalog:

~~~js
{
  code: "monthly",
  name: "Monthly",
  price: 1499,
  currency: "BDT",
  durationType: "months",
  durationValue: 1,
  features: ["caregiver_booking", "..."],
  isActive: true
}
~~~

`code` is unique. The sync script uses an upsert, so it can insert a missing plan or update an existing plan without creating duplicates.

## B2. FamilySubscription

There is at most one record per Family because `family` has a unique index.

Important fields:

- `family`: owner user ID.
- `status`: none, trialing, active, expired, or cancelled.
- `accessLevel`: core or premium.
- `trialUsed`: prevents activating the trial again.
- `trialStartedAt` and `trialEndsAt`: trial audit times.
- `currentPeriodStartedAt` and `currentPeriodEndsAt`: exact effective period.
- `planSnapshot`: the plan terms that activated this access.

A unique Family index prevents two concurrent "create subscription" requests from permanently creating two records. The service catches duplicate-key error 11000 and reloads the winner.

## B3. SubscriptionPayment

Each attempt has its own history record:

- Family owner.
- Provider and method.
- Pending/completed/failed/cancelled/refunded status.
- Amount and currency.
- Plan snapshot.
- Transaction reference.
- Completion confirmation reference.
- Stripe Checkout Session and Payment Intent IDs where relevant.
- Failure reason and timestamps.

Why store a snapshot? If the monthly plan changes from BDT 1499 to BDT 1599 next week, yesterday's receipt must still show BDT 1499 and yesterday's entitlements.

## B4. Important indexes

~~~js
subscriptionPaymentSchema.index({
  family: 1,
  createdAt: -1,
});

subscriptionPaymentSchema.index(
  {
    stripeCheckoutSessionId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      stripeCheckoutSessionId: {
        $type: "string",
      },
    },
  },
);
~~~

The first supports Family history. The partial unique Stripe index enforces idempotency for Stripe records while allowing prototype records without a session ID.

# Part C - Access, expiry, and renewal

## C1. Effective access

`determineSubscriptionAccess(subscription, now)` does not blindly trust the stored status. It checks:

- status is trialing or active;
- access level is premium;
- exact expiry exists;
- expiry is later than now.

If any condition fails, it returns Core access.

This is defense in depth: even before the expired status is written back, a request after the exact expiry cannot use Premium.

## C2. Request-time expiry in the current code

The current repository does not run a cron job. Expiry is synchronized when subscription access is requested or Premium middleware runs:

~~~text
request
  -> getFamilySubscriptionAccess
  -> synchronizeSubscriptionExpiry
  -> compare currentPeriodEndsAt with now
  -> atomically mark stale active/trialing record expired
  -> determine effective access
~~~

This is safe for authorization because every protected request recalculates access. Its limitation is that an unused expired account may remain stored as active until the next relevant request.

## C3. How a cron job could be added later

A scheduled worker should reuse the same business rule instead of creating a second expiry rule:

~~~js
export async function expireAllDueSubscriptions(now = new Date()) {
  return FamilySubscription.updateMany(
    {
      status: {
        $in: ["active", "trialing"],
      },
      currentPeriodEndsAt: {
        $lte: now,
      },
    },
    {
      $set: {
        status: "expired",
        accessLevel: "core",
      },
    },
  );
}
~~~

A host scheduler could call a script every hour. Keep request-time checks too, because cron execution can be delayed.

## C4. Renewal start rule

When a successful payment renews access:

- if current Premium access ends in the future, start the new duration from the current expiry;
- otherwise start from now.

~~~js
let renewalStart = now;

if (
  subscription.currentPeriodEndsAt &&
  subscription.currentPeriodEndsAt > now
) {
  renewalStart = subscription.currentPeriodEndsAt;
}
~~~

This preserves paid remaining time.

## C5. Month and year date safety

Adding one month to January 31 can overflow into March. The date helper temporarily moves to day 1, changes the month/year, and then clamps the original day to the destination month's final day.

# Part D - API contract

## D1. Family routes

All routes require authentication. Routes after the plan catalog also require the Family role.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/subscriptions/plans` | List active plans and payment availability |
| GET | `/api/subscriptions/me` | Current stored subscription, effective access, reminder |
| POST | `/api/subscriptions/trial/activate` | Activate one-time trial |
| POST | `/api/subscriptions/purchase` | Create pending prototype payment |
| POST | `/api/subscriptions/payments/:paymentId/simulate-success` | Complete prototype |
| POST | `/api/subscriptions/payments/:paymentId/simulate-failure` | Fail prototype |
| POST | `/api/subscriptions/payments/:paymentId/cancel` | Cancel pending prototype |
| POST | `/api/subscriptions/stripe/checkout` | Create Stripe Checkout |
| GET | `/api/subscriptions/stripe/checkouts/:sessionId` | Read caller-owned local result |
| POST | `/api/subscriptions/stripe/payments/:paymentId/cancel` | Cancel open Stripe Checkout |
| GET | `/api/subscriptions/payments?page=1&limit=3` | Family-owned history |
| PATCH | `/api/subscriptions/me/cancel` | Cancel current subscription |

## D2. Prototype purchase request

~~~json
{
  "planCode": "monthly",
  "paymentMethod": "test_card"
}
~~~

The endpoint deliberately rejects `stripe_checkout`. Stripe has a separate signed workflow.

The request must not include an authoritative price or duration. Even if extra fields are sent, the service reloads the plan from MongoDB.

## D3. Payment-history response

~~~json
{
  "success": true,
  "data": {
    "payments": [],
    "pagination": {
      "page": 1,
      "limit": 3,
      "total": 0,
      "pages": 0
    }
  }
}
~~~

## D4. Admin routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/subscriptions/analytics` | Totals, revenue, active access, plan distribution |
| GET | `/api/admin/subscriptions/payments` | Filtered/paginated transaction audit |

Family users receive 403 from Admin routes.

# Part E - Authorization and validation

## E1. Role and ownership

Authentication proves who the caller is. Role middleware proves the caller is a Family or Admin. Ownership queries prove the requested payment belongs to that Family.

~~~js
const payment = await SubscriptionPayment.findOne({
  _id: paymentId,
  family: familyUserId,
});

if (!payment) {
  throw new ApiError(404, "Payment not found.");
}
~~~

The same 404 is used for missing and somebody else's payment. This is concealed-404 behavior.

## E2. Premium middleware

~~~js
router.post(
  "/bookings",
  asyncHandler(
    requireFamilyEntitlement(
      ENTITLEMENTS.CAREGIVER_BOOKING,
    ),
  ),
  asyncHandler(createBooking),
);
~~~

The middleware loads the signed-in Family's effective access. It returns 403 with the required entitlement when access is unavailable.

`PremiumFeatureGate` improves the interface, but it cannot replace this backend check because a caller can bypass React and send an HTTP request directly.

## E3. Validation gap fixed during this refactor

Previously the prototype validator accepted every value from the global payment-method list, including `stripe_checkout`. A client could therefore create and simulate a "Stripe" payment without Stripe verification.

The validator now has an explicit prototype allowlist:

~~~js
const PROTOTYPE_PAYMENT_METHODS = [
  "test_card",
  "test_mobile_banking",
  "test_wallet",
];
~~~

## E4. Safe Admin search

Untrusted search text must not become an uncontrolled regular expression. The helper escapes regex operators first:

~~~js
const safeSearch =
  escapeRegularExpression(request.query.search);

filter.transactionReference = {
  $regex: safeSearch,
  $options: "i",
};
~~~

A search for `DEV-.*` now means those literal characters rather than "any matching transaction."

# Part F - Prototype payment transaction

## F1. Why use a transaction?

Successful payment changes related records:

1. payment becomes completed;
2. confirmation reference and completion time are saved;
3. Family subscription becomes active/renewed;
4. a notification may be created.

A transaction prevents a half-finished state such as completed payment with no Premium access.

## F2. Transaction structure

~~~js
const session = await mongoose.startSession();

try {
  await session.withTransaction(async function settlePayment() {
    // read and write payment using session
    // update FamilySubscription using session
    // create notification using session
  });
} finally {
  await session.endSession();
}
~~~

Every query participating in the transaction must receive the same session.

## F3. Atomic pending transition

~~~js
const completed = await SubscriptionPayment.findOneAndUpdate(
  {
    _id: paymentId,
    family: familyUserId,
    status: "pending",
  },
  {
    $set: {
      status: "completed",
      completedAt: now,
    },
  },
  {
    new: true,
    session,
    runValidators: true,
  },
);
~~~

The status condition prevents two concurrent requests from both completing the same pending record.

## F4. Idempotency

If a completed payment is confirmed again, the service returns the existing result with `alreadyCompleted: true`. It does not calculate and add another access period.

# Part G - Stripe details

## G1. Why raw body comes before express.json

Stripe signs the exact request bytes. JSON parsing changes those bytes into a JavaScript object.

Correct app order:

~~~js
app.use(
  "/api/subscriptions/stripe/webhook",
  express.raw({
    type: "application/json",
  }),
  stripeWebhookRoutes,
);

app.use(express.json({
  limit: "1mb",
}));
~~~

## G2. Signature verification

~~~js
const event = stripe.webhooks.constructEvent(
  rawBody,
  signature,
  env.stripeWebhookSecret,
);
~~~

Do not call `JSON.parse` first. Do not trust a normal request body containing `type: "checkout.session.completed"`.

## G3. What completion validates

Before activating access, verify:

- local pending payment exists;
- event/session belongs to that local payment;
- payment status is paid;
- amount equals the local authoritative amount in minor units;
- currency matches;
- metadata family/payment/plan values match;
- caller/event cannot replace local ownership;
- event is not a duplicate.

## G4. Stripe environment variables

Backend only:

~~~text
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PAYMENTS_ENABLED=true
CLIENT_URL=https://your-frontend.example
~~~

Hosted Checkout does not require exposing the Stripe secret or webhook secret to Vite. Secrets belong only on the backend.

## G5. Local webhook command

~~~powershell
stripe.exe listen --events checkout.session.completed,checkout.session.expired,checkout.session.async_payment_failed --forward-to http://localhost:5034/api/subscriptions/stripe/webhook
~~~

Copy the CLI's current `whsec_...` value into the local backend environment and restart the backend.

# Part H - Frontend logic

## H1. Shared SubscriptionContext

`SubscriptionProvider` loads access only for a signed-in Family user and exposes:

~~~js
{
  loading,
  data,
  error,
  refreshSubscription
}
~~~

The effect itself is not async:

~~~jsx
useEffect(function refreshWhenSessionChanges() {
  void refreshSubscription();
}, [refreshSubscription]);
~~~

React expects an effect to return only cleanup or nothing, not a Promise.

## H2. Parallel page loading

Plans, current access, and payment history do not depend on one another:

~~~js
const results = await Promise.all([
  subscriptionService.listPlans(),
  refreshSubscription(),
  subscriptionService.listPayments({
    page,
    limit: 3,
  }),
]);
~~~

If one fails, `Promise.all` rejects and the catch block shows the normalized error.

## H3. Stripe return polling

The browser may return before Stripe's webhook finishes. The page performs six one-second checks and stops early when status is no longer pending. This is bounded polling, not an endless loop.

## H4. Unfinished prototype cleanup

The page stores settled IDs in a `Set` inside `useRef`. On modal close or component cleanup, it tries to cancel a still-pending prototype record. Backend stale-payment expiry is the fallback if navigation interrupts the request.

## H5. Reminder error handling

Reminder dismissal uses:

~~~js
setBusy("dismiss-reminder");

try {
  await subscriptionService.dismissReminder(id, 24);
  // remove reminder from local state
} catch (error) {
  showToast(normalizeApiError(error).message, "error");
} finally {
  setBusy("");
}
~~~

This prevents double clicks and unhandled Promise rejection.

# Part I - Admin analytics

## I1. Status totals aggregation

~~~js
const rows = await SubscriptionPayment.aggregate([
  {
    $group: {
      _id: "$status",
      count: {
        $sum: 1,
      },
      amount: {
        $sum: "$amount",
      },
    },
  },
]);
~~~

Each result row represents one status. Only the completed row contributes to completed revenue.

## I2. Plan performance

~~~js
[
  {
    $match: {
      status: "completed",
    },
  },
  {
    $group: {
      _id: "$planSnapshot.code",
      name: {
        $first: "$planSnapshot.name",
      },
      transactions: {
        $sum: 1,
      },
      revenue: {
        $sum: "$amount",
      },
    },
  },
  {
    $sort: {
      revenue: -1,
    },
  },
]
~~~

Historical plan snapshots keep analytics meaningful after catalog changes.

## I3. Why Promise.all is useful

Payment totals, active Premium count, active trial count, plan distribution, and recent payments are independent reads. Running them concurrently reduces waiting time. It does not make them one database transaction.

# Part J - Common live modifications

## J1. Add a new plan

1. Add the definition to `subscriptionPlans.js`.
2. Add the code to the allowed plan-code constants.
3. Run `npm.cmd run db:sync-subscription-plans --prefix backend`.
4. Verify it appears from GET `/api/subscriptions/plans`.
5. Verify date math tests for its duration type.

Do not let the frontend define the price.

## J2. Add a new Premium entitlement

1. Add one value to `ENTITLEMENTS`.
2. Include it in the relevant plan feature array.
3. Protect the backend route with `requireFamilyEntitlement`.
4. Add frontend lock/upgrade guidance.
5. Test Core gets 403 and Premium succeeds.

## J3. Add a status filter

Backend:

~~~js
const allowedStatuses = [
  "pending",
  "completed",
];

if (!allowedStatuses.includes(request.query.status)) {
  throw new ApiError(422, "Status is invalid.");
}
~~~

Frontend: send status as Axios `params` and reset page to one when it changes.

## J4. Show payment count on another page

Backend query:

~~~js
const paymentCount =
  await SubscriptionPayment.countDocuments({
    family: request.user._id,
    status: "completed",
  });
~~~

Add it to the existing controller response, then read and render that response field. Do not create a second API unless it is genuinely reusable.

## J5. Add a refund status for a demo

For a simple test, update only completed caller/Admin-authorized records atomically:

~~~js
const payment =
  await SubscriptionPayment.findOneAndUpdate(
    {
      _id: request.params.paymentId,
      status: "completed",
    },
    {
      $set: {
        status: "refunded",
        refundedAt: new Date(),
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );
~~~

In a real Stripe integration, the backend should request the provider refund and use provider confirmation.

## J6. Add a cron expiry worker

1. Export a service that updates due records.
2. Create a script that connects, calls it, logs result, and disconnects.
3. Configure the hosting scheduler.
4. Retain request-time access verification.
5. Add a test with a controlled `now` date.

# Part K - Errors to explain in viva

| Status | Meaning here |
|---|---|
| 401 | Missing/invalid session |
| 403 | Wrong role or missing Premium entitlement |
| 404 | Missing or non-owned payment (concealed ownership) |
| 409 | Duplicate trial, invalid state transition, provider/local conflict |
| 422 | Invalid plan, method, ObjectId input, page, or limit |
| 503 | Prototype/Stripe provider configuration unavailable |

Examples:

- Unsupported prototype method -> 422.
- Caregiver activates Family trial -> 403.
- Family B completes Family A payment -> 404.
- Reusing one-time trial -> 409.
- Stripe disabled/missing secret -> 503.
- Stripe amount differs from local amount -> 409.

# Part L - Testing and verification

## L1. Focused unit tests

~~~powershell
npm.cmd run test:subscriptions --prefix backend
npm.cmd run test:stripe --prefix backend
~~~

They cover period math, access, entitlements, snapshots, references, validation, safe search, amount conversion, and Stripe result validation.

## L2. Authenticated MongoDB smoke test

~~~powershell
npm.cmd run test:subscriptions:integration --prefix backend
~~~

It creates marked temporary users, logs in through the real endpoint, verifies roles, trial, ownership, backend-authoritative price, prototype/Stripe separation, idempotency, failure, stale cancellation, Family history, and Admin analytics. Cleanup deletes only IDs tracked by that run.

## L3. Plan and index synchronization

~~~powershell
npm.cmd run db:sync-subscription-plans --prefix backend
npm.cmd run db:sync-indexes --prefix backend
~~~

## L4. Full verification

~~~powershell
node --test backend/test
npm.cmd run build --prefix frontend
git diff --check
git status --short
~~~

# Part M - Viva questions and short answers

## Why three models?

The catalog, current access, and historical payments change for different reasons. Separating them avoids overwriting receipts when products change.

## Why copy a plan snapshot?

It preserves the exact purchased price, duration, name, and entitlements for receipts, renewals, and analytics.

## Why not send amount from React?

Browser requests are untrusted and can be edited. The backend loads the active plan by code.

## Why is pending not access?

Creating a payment intent or Checkout Session does not prove money was accepted. Only confirmed completion grants Premium.

## Why use a transaction?

Payment completion and access activation must succeed or fail together.

## Why use an atomic status filter?

`status: "pending"` inside the update prevents two concurrent completion requests from both succeeding.

## Why a webhook?

The provider can securely notify the backend even if the browser closes or never returns.

## Why raw body?

Stripe's signature covers the original bytes. Parsing first changes the signed material.

## Why poll after Stripe redirect?

The browser redirect and webhook are separate network requests and can arrive in either order.

## Is expiry currently cron-based?

No. Current authorization is safely request-time and checks exact expiry. A cron worker could proactively update unused records, but request-time checking should remain.

## Is frontend Premium gating enough?

No. It is presentation only. Backend entitlement middleware is the authorization boundary.

# Part N - Demonstration checklist

1. Sign in as Family.
2. Open Subscription and show Core state.
3. Activate the one-time trial and show exact activation/expiry.
4. Attempt the trial again and explain 409.
5. Choose a plan and create a prototype payment.
6. Show the DEV transaction reference while pending.
7. Simulate failure and show that access stays unchanged.
8. Create another payment and simulate success.
9. Show the confirmation reference, Premium state, and paginated history.
10. Refresh and prove access persists in MongoDB.
11. Sign in as Admin and show analytics plus transactions.
12. Explain that Stripe uses hosted Checkout and signed webhooks.
13. Show one Premium backend route protected by entitlement middleware.
14. Explain current request-time expiry and the optional cron improvement.
