# Family Subscription, Premium Access, and Stripe Sandbox Payments

## Purpose

One subscription covers every elderly profile linked to a Family account.
Core access preserves profiles, reports, basic vitals, existing bookings,
required ongoing-care actions, and payment history.

Premium entitlements are caregiver_booking, scheduled_booking,
long_term_booking, wellness_early_alerts, wellness_ai_summary, and
advanced_vitals.

## Trial and plans

The one-time free trial is explicitly activated and lasts seven days.

| Plan | Duration | Prototype price |
| --- | --- | --- |
| Day Pass | Exactly 24 hours | BDT 199 |
| Monthly | One calendar month | BDT 1,499 |
| Yearly | One calendar year | BDT 14,999 |

Month-end and leap-day dates are safely clamped. Early renewal extends from
the existing expiry. Renewal after expiry starts at payment completion.

## Prototype warning

This is not a real payment gateway. It never requests or stores card numbers,
CVVs, PINs, bank passwords, wallet credentials, or account details.

Allowed methods are test_card, test_mobile_banking, and test_wallet.
Automatic billing is not implemented. Refunded is reserved as a status but no
refund workflow exists.

Configure backend/.env:

    PROTOTYPE_PAYMENTS_ENABLED=true
    FAMILY_TRIAL_DAYS=7
    SUBSCRIPTION_CURRENCY=BDT

Simulation must be disabled outside development.

## Stripe sandbox setup

Create a Stripe account, select a sandbox, and copy the test secret key. Then
configure backend/.env:

    STRIPE_PAYMENTS_ENABLED=true
    STRIPE_SECRET_KEY=sk_test_your_test_secret
    STRIPE_WEBHOOK_SECRET=whsec_from_stripe_cli
    SUBSCRIPTION_CURRENCY=BDT

Install and sign in to Stripe CLI, then forward signed events while the backend
is running:

    stripe login
    stripe listen --forward-to localhost:5000/api/subscriptions/stripe/webhook

Copy the displayed whsec value into STRIPE_WEBHOOK_SECRET and restart the
backend. Use 4242 4242 4242 4242, any future expiry date, and any three-digit
CVC. Test mode never moves real money and real card details must not be used.

The backend creates amounts from SubscriptionPlan records and converts BDT to
Stripe minor units. Browser redirects never activate access. Only a verified
checkout.session.completed event can complete the local transaction and extend
Premium access.

## APIs

    GET    /api/subscriptions/plans
    GET    /api/subscriptions/me
    POST   /api/subscriptions/trial/activate
    POST   /api/subscriptions/purchase
    POST   /api/subscriptions/stripe/checkout
    GET    /api/subscriptions/stripe/checkouts/:sessionId
    POST   /api/subscriptions/stripe/payments/:paymentId/cancel
    POST   /api/subscriptions/stripe/webhook
    PATCH  /api/subscriptions/me/cancel
    GET    /api/subscriptions/payments
    POST   /api/subscriptions/payments/:paymentId/simulate-success
    POST   /api/subscriptions/payments/:paymentId/simulate-failure
    POST   /api/subscriptions/payments/:paymentId/cancel
    GET    /api/notifications
    PATCH  /api/notifications/:notificationId/read
    PATCH  /api/notifications/:notificationId/dismiss

Purchase accepts only planCode and paymentMethod. Price, currency, duration,
access, ownership, dates, status, and references are backend-controlled.

## Consistency and ownership

Successful simulation uses a MongoDB transaction. Payment, subscription, and
notification changes succeed together. activationAppliedAt makes repeated
confirmation idempotent. Failed or cancelled payments do not change access.

Family ownership always comes from the authenticated user.

## Expiry and reminders

Expiry is synchronized lazily when subscription state or an entitlement is
requested.

- Trial: two days, one day, expiry
- Day Pass: two hours, thirty minutes, expiry
- Monthly/yearly: seven days, three days, one day, expiry

Deduplication keys prevent duplicate notices. Remind me later stores
dismissedUntil. The dashboard uses a controlled modal and the subscription
page uses a banner.

## Add a plan

Add its code to SUBSCRIPTION_PLAN_CODES and its backend definition to
backend/config/subscriptionPlans.js. Use hours, months, or years, then run:

    npm.cmd run db:sync-subscription-plans --prefix backend

Snapshots ensure later price changes do not rewrite history.

## Add or protect an entitlement

Add the code to ENTITLEMENTS, include it in plan features, synchronize plans,
and protect only the new Premium action with requireFamilyEntitlement. Never
check plan names in controllers. Historical and ongoing-care routes remain
Core-accessible.

PremiumFeatureGate explains frontend locks, but backend middleware is
authoritative.

## Frontend

The Family page is /subscription. It shows access, expiry, trial, plans,
benefits, Stripe sandbox checkout, simulator fallback, and payment history.

## Verification

    npm.cmd run test:subscriptions --prefix backend
    npm.cmd run test:stripe --prefix backend
    npm.cmd run test:subscriptions:integration --prefix backend
    npm.cmd run test:bookings --prefix backend
    npm.cmd run build --prefix frontend

Integration testing requires development MongoDB and enabled simulation.

## Provider behavior

Stripe Checkout uses the official backend SDK and a hosted card form. The
webhook route receives raw request bytes before express.json so Stripe signature
verification remains valid. Completed Session amount, currency, ownership, and
local payment identifiers must all match before activation. Repeated webhook
delivery remains idempotent through the completed payment state and unique
provider identifiers.

## Limitations

- Stripe is integrated in sandbox mode; live merchant activation is not configured
- No recurring automatic billing
- No functional refunds
- Lazy reminders instead of a scheduled worker
- Demonstration BDT prices
- Transactions require a replica set or compatible hosted MongoDB
