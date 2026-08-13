# Family Subscription, Premium Access, and Prototype Payments

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

## APIs

    GET    /api/subscriptions/plans
    GET    /api/subscriptions/me
    POST   /api/subscriptions/trial/activate
    POST   /api/subscriptions/purchase
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
benefits, prototype checkout, and payment history.

## Verification

    npm.cmd run test:subscriptions --prefix backend
    npm.cmd run test:subscriptions:integration --prefix backend
    npm.cmd run test:bookings --prefix backend
    npm.cmd run build --prefix frontend

Integration testing requires development MongoDB and enabled simulation.

## Real provider integration

A future gateway should replace simulation actions in
prototypePaymentService.js. A verified webhook should locate the pending
payment and reuse idempotent transactional activation. Secrets stay backend
only and real financial credentials must never be stored.

## Limitations

- No real provider or recurring billing
- No functional refunds
- Lazy reminders instead of a scheduled worker
- Demonstration BDT prices
- Transactions require a replica set or compatible hosted MongoDB
