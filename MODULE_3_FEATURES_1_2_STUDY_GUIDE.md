# Module 3 Study Guide - Features 1 and 2

This guide covers the two Module 3 features assigned to Md. Imam Hasan:

1. Family Subscription, Premium Access, and Payment System
2. Family Account Management and Email Re-verification

It follows the code on the integration/module3-demo branch.

## How to study the code

Follow one request from the browser to MongoDB and back:

1. Start with the frontend page.
2. Find the frontend service method called by the page.
3. Find the matching backend route.
4. Read its middleware in route order.
5. Read the controller.
6. Follow the controller into services and models.
7. Finish with tests, edge cases, and limitations.

The frontend presents actions, but the backend owns authorization, prices,
dates, access decisions, payment status, and verification security.

---

# Feature 1: Subscription, Premium Access, and Payments

## Short explanation

A Family account can activate one trial or create a simulated plan payment.
Only a successfully completed payment activates or extends Premium access.
Administrators can audit the simulated transactions and business analytics.

## Frontend files to study

Study these in order:

1. frontend/src/pages/family/FamilySubscriptionPage.jsx
   - Main Family subscription screen
   - Loads plans, access, reminders, and three payments per page
   - Opens checkout and cancels unfinished payments

2. frontend/src/services/subscriptionService.js
   - Maps UI actions to subscription API endpoints

3. frontend/src/components/subscription/CurrentSubscriptionCard.jsx
   - Shows status, activation time, expiry, and period progress

4. frontend/src/components/subscription/PremiumFeatureGate.jsx
   - Explains a frontend Premium lock
   - It is not the security boundary

5. frontend/src/components/subscription/SubscriptionStatusCard.jsx
   - Compact dashboard subscription summary

6. frontend/src/components/subscription/SubscriptionExpiryModal.jsx
   - Expiry reminder and subscription-page link

7. frontend/src/pages/admin/AdminSubscriptionPaymentsPage.jsx
   - Admin filtering, transaction search, and pagination

8. frontend/src/components/admin/AdminBusinessAnalytics.jsx
   - Revenue, active access, plan distribution, and payment health

9. frontend/src/services/adminService.js
   - Protected Admin analytics and transaction calls

## Backend files to study

1. backend/routes/subscriptionRoutes.js
   - Authentication, Family role protection, validation, and endpoints

2. backend/controllers/subscriptionController.js
   - API contracts and controller-to-service delegation

3. backend/services/prototypePaymentService.js
   - The most important payment file
   - References, pending payments, successful completion, idempotency,
     renewal, failure/cancellation, notifications, and stale cleanup

4. backend/services/subscriptionService.js
   - One subscription per Family, trial activation, and expiry synchronization

5. backend/services/entitlementService.js
   - Calculates effective Core or Premium access

6. backend/middleware/requireFamilyEntitlement.js
   - Protects Premium backend actions

7. backend/utils/subscriptionPeriod.js
   - Calculates 24-hour, monthly, yearly, and renewal periods

8. backend/utils/subscriptionConstants.js
   - Central status, method, plan, and entitlement values

9. backend/config/subscriptionPlans.js
   - Backend-controlled Day Pass, Monthly, and Yearly definitions

10. backend/models/SubscriptionPlan.js
    - Current plan catalogue

11. backend/models/FamilySubscription.js
    - Current Family access state

12. backend/models/SubscriptionPayment.js
    - Payment-attempt history and plan snapshot

13. backend/controllers/adminSubscriptionController.js
    - Admin aggregation and paginated transaction audit

14. backend/routes/adminUserRoutes.js
    - Shared Admin-only gate

15. backend/services/subscriptionReminderService.js
    - Deduplicated trial and expiry reminders

## Data relationship

~~~text
User (Family)
    |
    | one-to-one through unique family field
    v
FamilySubscription ------> current SubscriptionPlan
    |
    | one-to-many history
    v
SubscriptionPayment -----> immutable planSnapshot
~~~

Why there are three subscription models:

- SubscriptionPlan is the current catalogue.
- FamilySubscription stores the Family account's current access.
- SubscriptionPayment stores every attempt for auditing.
- A plan snapshot prevents future price changes from rewriting old history.

## Important states

Subscription statuses:

- none
- trialing
- active
- expired
- cancelled

Payment statuses:

- pending
- completed
- failed
- cancelled
- refunded is reserved; no refund workflow exists

Access levels are core and premium.

Allowed test methods are test_card, test_mobile_banking, and test_wallet.
No card number, CVV, PIN, banking password, or real account data is stored.

## Successful payment flow

~~~text
Family selects a plan and test method
        |
        v
POST /api/subscriptions/purchase
        |
        | load active plan by planCode
        | copy authoritative price/duration/features
        | generate DEV transaction reference
        v
SubscriptionPayment(status = pending)
        |
        v
Family clicks Simulate success
        |
        v
POST /api/subscriptions/payments/:id/simulate-success
        |
        | start MongoDB transaction
        | verify Family ownership and payment state
        | calculate renewal period
        | activate FamilySubscription
        | complete payment and create confirmation
        | create deduplicated notification
        v
Commit transaction and reload the UI
~~~

## Critical logic to remember

### Backend-authoritative plan values

The purchase request accepts only planCode and paymentMethod. The server loads
the plan and copies its price, currency, duration, and features. A client cannot
activate a cheap plan by submitting a fake price or duration.

### Transaction and confirmation references

- The pending attempt receives a DEV transaction reference.
- Only successful completion receives a SIM-CONF confirmation reference.
- Failed and cancelled attempts remain auditable without looking successful.

### MongoDB transaction

completePrototypePayment changes the payment, subscription, and completion
notification inside one MongoDB transaction. This prevents payment completion
without access, or access without payment completion.

MongoDB transactions require a replica set such as MongoDB Atlas.

### Idempotency

If a completed payment already has activationAppliedAt, another success request
returns the existing result with alreadyCompleted true. It does not extend the
subscription twice. This protects against double-clicks and network retries.

### Renewal start

- Early renewal starts from the existing future expiry.
- Renewal after expiry starts from payment completion.

The user keeps unused time when renewing early.

### Safe calendar periods

- Day Pass adds exactly 24 hours.
- Monthly adds one UTC calendar month.
- Yearly adds twelve calendar months.
- January 31 is clamped to February 28 or 29.
- A leap-day yearly renewal is clamped safely.

### Effective access

Premium requires all three conditions:

- stored accessLevel is premium;
- status is trialing or active;
- currentPeriodEndsAt is a valid future date.

Expired and cancelled records receive effective Core access.

### Entitlement enforcement

The backend checks entitlement codes, not plan names. Booking creation follows:

~~~text
requireAuth
-> allowRoles("family")
-> requireFamilyEntitlement(CAREGIVER_BOOKING)
-> validateBookingRequest
-> createBooking
~~~

Frontend gates improve the experience, but backend middleware enforces security.

### Unfinished payments

- Closing checkout cancels the pending payment.
- Component unmount sends best-effort cancellation.
- Attempts older than 15 minutes are lazily marked cancelled.

### Ownership

The Family ID comes from request.user. Payment reads and writes include that
Family ID, so one Family cannot operate on another Family's transaction.

### Admin analytics

The Admin aggregation calculates:

- simulated revenue from completed payments only;
- active Premium families;
- active trials;
- totals by payment status;
- plan distribution;
- recent transactions.

All Admin endpoints are protected by requireAuth and allowRoles("admin").

## Subscription APIs

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | /api/subscriptions/plans | List active backend plans |
| GET | /api/subscriptions/me | Get subscription, access, and reminder |
| POST | /api/subscriptions/trial/activate | Activate one-time trial |
| POST | /api/subscriptions/purchase | Create pending payment |
| POST | /api/subscriptions/payments/:id/simulate-success | Activate or renew |
| POST | /api/subscriptions/payments/:id/simulate-failure | Fail without access |
| POST | /api/subscriptions/payments/:id/cancel | Cancel pending payment |
| GET | /api/subscriptions/payments | Family paginated history |
| PATCH | /api/subscriptions/me/cancel | Cancel active access |
| GET | /api/admin/subscriptions/analytics | Admin business metrics |
| GET | /api/admin/subscriptions/payments | Admin transaction audit |

## Feature 1 demonstration

1. Sign in as Family and open Subscription.
2. Show current access and expiry.
3. Select Monthly and a test method.
4. Create payment and show the DEV reference.
5. Simulate success.
6. Show Premium access and SIM-CONF confirmation.
7. Show paginated payment history.
8. Open another checkout and close it; show cancelled status.
9. Sign in as Admin.
10. Show revenue, Premium count, plan performance, filters, search, and history.

## Feature 1 viva questions

**Why save a plan snapshot?**
It preserves the exact purchased price, duration, and features if the live plan
changes later.

**Why create a transaction ID before success?**
Every attempt needs an audit identity. Successful attempts additionally receive
a confirmation reference.

**How is double activation prevented?**
Ownership and state checks, a MongoDB transaction, and activationAppliedAt.

**Can React state unlock Premium?**
No. Protected backend routes calculate access and require the entitlement.

**Is this a real gateway?**
No. A real gateway would replace simulation actions with a verified webhook
while reusing the transactional, idempotent activation service.

---

# Feature 2: Family Account and Email Re-verification

## Short explanation

A Family owner can update their name normally. Changing the sign-in email
requires the current password, makes the account temporarily unverified, sends
a verification link to the new address, and ends the current session.

## Frontend files to study

1. frontend/src/pages/family/FamilyAccountPage.jsx
   - Name, email, and conditional current-password form
   - Refreshes user after name-only update
   - Clears local auth and redirects after email change

2. frontend/src/services/authService.js
   - updateFamilyAccount, verifyEmail, and resendVerification

3. frontend/src/context/AuthContext.jsx
   - refreshUser and clearSession

4. frontend/src/pages/auth/VerifyEmailPage.jsx
   - Reads token and calls verification endpoint
   - Reuses one request under React Strict Mode

5. frontend/src/App.jsx
   - Account route is /account
   - Public verification route is /verify-email

## Backend files to study

1. backend/routes/authRoutes.js
   - Family-only PATCH /api/auth/account route

2. backend/middleware/validateAuth.js
   - Normalizes and validates name, email, and currentPassword

3. backend/controllers/authController.js
   - updateFamilyAccount
   - issueVerificationEmail
   - verifyEmail
   - resendVerification

4. backend/models/User.js
   - Unique email, hidden password, Google ID, role, isVerified

5. backend/models/EmailVerificationToken.js
   - Hashed token, expiry, TTL index, and usedAt

6. backend/utils/authTokens.js
   - Random token generation and SHA-256 hashing

7. backend/services/emailService.js
   - Nodemailer, SMTP validation, safe HTML, and delivery

8. backend/middleware/auth.js
   - Reloads User and rejects unverified accounts

9. backend/config/env.js
   - Reads backend-only SMTP and client URL settings

## Name-only flow

~~~text
Family changes name
    |
    v
PATCH /api/auth/account
    |
    | authenticate, check Family role, normalize input
    v
Update User.name
    |
    v
Return public user without ending session
    |
    v
Frontend refreshes AuthContext
~~~

## Email-change flow

~~~text
Family enters new email and current password
        |
        v
PATCH /api/auth/account
        |
        | load normally hidden password
        | reject Google-only account
        | bcrypt.compare current password
        | reject duplicate email
        v
Save new email and isVerified = false
        |
        | generate random raw token
        | store SHA-256 token hash
        | set 24-hour expiry
        | email raw token to NEW address
        v
Clear HTTP-only session cookie
        |
        v
Frontend clears AuthContext and redirects
        |
        v
User opens /verify-email?token=...
        |
        | hash token and find unexpired record
        | set User.isVerified = true
        | record usedAt
        v
User signs in with the new email
~~~

## Critical logic to remember

### Family-only authorization

Route order is:

~~~text
requireAuth
-> allowRoles("family")
-> validateFamilyAccountUpdate
-> updateFamilyAccount
~~~

The User ID comes from the authenticated session, not the body.

### Password is hidden by default

User.password uses select false. The controller explicitly selects it only for
bcrypt.compare during an email change. It is never returned to React.

### Google-only account restriction

A Google-only account may not have a local password. It cannot change email
through this form because the app cannot confirm a current password and Google
controls that sign-in identity.

### Normalization and duplicate protection

The server trims name and lowercases/trims email. The controller checks whether
another User owns the email, and MongoDB's unique index handles race conditions.

### Raw verification token is not stored

The server creates 32 cryptographically random bytes. The email receives the raw
token, but MongoDB stores only its SHA-256 hash.

### Expiry and replacement

- Verification links expire after 24 hours.
- The query only accepts an unexpired token.
- A TTL index removes expired records.
- Issuing a new link deletes the user's older verification tokens.

### SMTP rollback safety

Before changing email, the controller remembers the old name, email, and
verification state. If save or email delivery fails, it restores those values
and removes the unusable token. The Family owner is not locked out.

### Session termination

- Backend clears the HTTP-only session cookie.
- Frontend clearSession removes the cached React user.

The backend is the security boundary. The frontend action immediately updates
the displayed state.

### Existing cookies while unverified

requireAuth verifies the JWT and reloads the User from MongoDB. It rejects an
unverified Family account, so another browser's existing cookie cannot call
protected APIs during re-verification.

The project does not use a session-version blacklist. After verification, an
otherwise unexpired cookie from another browser could work again. The feature's
stated requirement is termination of the active session; global permanent
revocation would need session versioning or stored sessions.

### Enumeration-safe resend

Resend returns the same neutral message whether an eligible account exists or
not. This prevents callers from learning which email addresses are registered.

## Account and verification APIs

| Method | Endpoint | Purpose |
| --- | --- | --- |
| PATCH | /api/auth/account | Update Family name or email |
| GET | /api/auth/verify-email?token=... | Verify emailed token |
| POST | /api/auth/resend-verification | Replace and resend link |
| GET | /api/auth/me | Restore or refresh user |
| POST | /api/auth/logout | Clear session cookie |

## Feature 2 demonstration

### Name update

1. Sign in as Family and open My account.
2. Change only the name.
3. Save and show the session remains active.
4. Refresh and show the saved name.

### Email update

1. Enter a new unused email.
2. Show the current-password field appears.
3. Test an incorrect password.
4. Enter the correct password and save.
5. Show redirect to Sign in.
6. Try signing in before verification; it should fail.
7. Open the email sent to the new address.
8. Open the verification link.
9. Sign in with the new email.

Important failure cases:

- invalid or duplicate email;
- missing or incorrect current password;
- Google-only account;
- invalid or expired token;
- SMTP delivery failure and rollback.

## Feature 2 viva questions

**Why require the current password?**
Changing email changes the sign-in identity and recovery destination. An open
browser session alone is not enough confirmation.

**Why mark the account unverified?**
Protected access must pause until ownership of the new address is proven.

**Why hash the token?**
It reduces damage if verification-token records are exposed.

**Why reload User in authentication middleware?**
JWT claims can be valid but stale. Reloading immediately enforces deletion and
verification-state changes.

**What if Nodemailer fails?**
The old email and verification state are restored to prevent account lockout.

---

# Environment variables to recognize

Never show or memorize real secret values.

~~~text
PROTOTYPE_PAYMENTS_ENABLED=true
FAMILY_TRIAL_DAYS=7
SUBSCRIPTION_CURRENCY=BDT

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM=...
CLIENT_URL=http://localhost:5173
~~~

- Simulation is rejected in production even when its flag is enabled.
- Gmail generally requires an App Password.
- CLIENT_URL builds the frontend verification link.
- Secrets remain in ignored backend environment files.

---

# Tests and commands

## Subscription unit tests

backend/test/subscriptionAccess.test.js checks Core/Premium decisions,
entitlements, expiry, cancellation, and unknown entitlement rejection.

backend/test/subscriptionPeriod.test.js checks exact 24-hour access, month-end
clamping, leap years, and renewal start.

backend/test/subscriptionPaymentHelpers.test.js checks authoritative snapshots,
unique DEV references, and reminder thresholds.

## Authenticated integration test

backend/scripts/smokeSubscriptions.js checks:

- role restrictions and one-time trial;
- backend-authoritative price/duration;
- cross-Family isolation;
- success and repeated idempotent completion;
- failure without access;
- abandoned-payment cleanup;
- Family payment-history isolation;
- Admin analytics and transaction access.

## SMTP test

backend/scripts/testEmailDelivery.js authenticates with SMTP and sends a real
verification-style message. It tests delivery configuration, not the complete
account-update rollback flow.

## Commands

~~~powershell
npm.cmd run test:subscriptions --prefix backend
npm.cmd run test:subscriptions:integration --prefix backend
npm.cmd run test:email --prefix backend
npm.cmd run build --prefix frontend
~~~

The integration smoke test creates temporary records. Run it only against a
confirmed development or test database.

---

# Short presentation scripts

## Feature 1

"The frontend lets a Family select a plan and test method, but the backend
controls price, duration, and entitlements. Checkout creates a pending audit
record with a DEV reference. Successful simulation uses a MongoDB transaction
to complete the payment, activate or extend access, create a confirmation
reference, and notify the Family. Repeated confirmation is idempotent. Families
see paginated history, while Admin sees simulated revenue, plan distribution,
payment health, and all transactions."

## Feature 2

"A name-only change does not end the session. Email change requires the current
password, checks uniqueness, marks the account unverified, and emails a 24-hour
link to the new address. Only a SHA-256 token hash is stored. The server clears
the session and middleware blocks protected requests while unverified. If SMTP
fails, the previous email and verification state are restored."

## Final checklist

- Explain Core, Premium, status, and entitlement.
- Explain transaction versus confirmation reference.
- Explain plan snapshots and backend-authoritative prices.
- Explain the MongoDB transaction and idempotency marker.
- Explain early renewal versus expired renewal.
- Explain why frontend gating is not security.
- Explain select false and bcrypt.compare for passwords.
- Explain random, hashed, expiring verification tokens.
- Explain SMTP rollback safety.
- Clearly state that payment is simulated.
- Never expose environment secrets during the demo.
