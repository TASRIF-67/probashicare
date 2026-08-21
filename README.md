# ProbashiCare

A full-stack elderly-care coordination platform for families living away from
their loved ones, verified local caregivers, and platform administrators.

For complete Windows installation, environment, startup, testing, and
troubleshooting instructions, see [LOCAL_SETUP.md](./LOCAL_SETUP.md).

## Included

- Family email/password signup with mandatory email verification
- Family Google signup with server-side ID-token verification
- Seeded admin login with no public admin signup
- Caregiver registration with shared email verification
- Draft, submission, rejection, resubmission, and approval application states
- Private Cloudinary verification-document upload scaffold
- Admin caregiver review queue with approve/reject decisions
- Approved caregiver dashboard and profile/availability editing
- HTTP-only JWT session cookies
- Shared API error handling and reusable auth/role middleware
- Protected family/admin routes and the elderly-profile onboarding handoff
- Public landing page and responsive family, caregiver, and admin workspaces
- Caregiver marketplace with protected contact information and weekly availability
- One-time, scheduled recurring, and long-term caregiver bookings
- Family booking history/cancellation and caregiver accept/decline/complete workflow
- Doctor appointment planning with caregiver escorts and optional Google Calendar sync
  ([setup and troubleshooting](./GOOGLE_CALENDAR_INTEGRATION.md))
- Caregiver daily wellness reports with mood, meals, medicine, observations, and vitals
- Thirty-day vital trends, rule-based early alerts, and optional Gemini summaries
- Deduplicated in-app notifications for booking and wellness events
- Family account settings with protected email changes and re-verification
- Family subscriptions, prototype BDT payments, transaction history, and admin analytics
- Reusable Button, Card, Input, and Modal components
- Responsive light/dark interface with a no-flash persisted preference
- Shared design tokens with a scoped caregiver accent in both light and dark mode

The elderly role remains reserved for a future authentication flow. Caregiver
authentication is now active, but the operational dashboard remains locked until
an administrator approves the initial professional application.

## Caregiver Booking Workflow

Family accounts select an authorized elderly profile, a caregiver, a booking type,
and slots that match the selected date range. The backend expands recurring
schedules into exact occurrences, validates time ranges, and uses reservation
documents with unique indexes to prevent concurrent double-booking.

Caregivers review requests from their booking workspace and can accept, decline,
or complete valid transitions. Families can track current status, review paginated
history, and cancel eligible bookings. Administrators have a separate booking
history view across family and caregiver accounts.

Run booking verification with:

```bash
npm run test:bookings --prefix backend
npm run test:bookings:integration --prefix backend
```

## Caregiver Verification

Caregivers register separately from families and verify their email through the
shared verification service. Their application supports a professional bio,
skills, languages, experience, hourly/monthly rates, service area, repeatable
availability periods, and one private verification document. Submitted records
are read-only until an administrator approves them or returns them with a reason.

The shared signup surface includes a neutral Family/Caregiver segment. Both
direct signup URLs preselect the appropriate mode, while switching modes updates
the hero, form, and accent in place without a page reload. Google signup remains
available only in Family mode; caregivers must provide the dedicated application
registration fields and verify their email.

Cloudinary credentials are optional during initial development. With
`REQUIRE_CAREGIVER_DOCUMENT=false`, drafts and final submission work without a
document. The requirement can be enabled later alongside the three
`CLOUDINARY_*` values described in [LOCAL_SETUP.md](./LOCAL_SETUP.md).

## Elderly Profile Management

Authenticated family users can create and manage multiple linked elderly profiles.
Each record supports personal information, medical history, allergies, current
medications, chronic diseases, and emergency contacts. Family access is stored in
a separate owner/editor/viewer link model; the current creator receives owner
access, and every profile read or write verifies that link. Profiles are archived
rather than permanently deleted.

Run the repeatable development smoke test while the API is running:

```bash
npm run test:elderly-profiles --prefix backend
```

The test creates temporary family and profile records, verifies onboarding status,
updates and archives the profile, checks cross-family isolation, and removes its
temporary records.

## Wellness Reports and Insights

Approved caregivers can create a draft report for an assigned care visit, complete
the report through a step-based form, and submit it as a read-only family update.
Reports support mood, meals, medicine intake, blood pressure, blood sugar, weight,
and health observations. Families can review report history, thirty-day trends,
and rule-based early wellness alerts.

Gemini can produce a concise wellness summary from sanitized, allow-listed values.
If Gemini is unavailable, a deterministic local fallback is used. These summaries
and alerts are informational coordination aids, not medical diagnoses. See
[GEMINI_WELLNESS_INTEGRATION.md](./GEMINI_WELLNESS_INTEGRATION.md).

```bash
npm run test:wellness-reports --prefix backend
npm run test:wellness-insights --prefix backend
```

## Notifications and Email Verification

The notification bell shows unread booking and submitted-report updates for the
authenticated user. Notification event keys make retries idempotent so one domain
event does not create duplicate alerts.

Password-based family and caregiver accounts must verify their email. Gmail SMTP
can be configured with a Google App Password in `backend/.env`; never store that
password in Git. A family owner may update their name from **My account**. Changing
the sign-in email requires the current password, sends a new verification link,
and suspends account access until the new address is verified.

Test SMTP authentication and one real verification-style message with:

```bash
npm run test:email --prefix backend
```

## Local setup

Requires Node.js 20+ and a MongoDB Atlas database.

1. Install the root helper dependency:

   ```bash
   npm install
   ```

2. Install both applications:

   ```bash
   npm run install:all
   ```

3. Copy `.env.example` to `backend/.env` and `frontend/.env`. Keep only the relevant variables in each file and replace all placeholder values.

   Development environment files are included locally and ignored by Git. Replace
   the MongoDB Atlas placeholders before starting the backend. SMTP may remain empty
   during development; verification links will be printed in the backend terminal.

4. In Google Cloud Console, create an OAuth 2.0 Web application. Add `http://localhost:5173` as an authorized JavaScript origin. Use the same client ID for `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID`.

5. Seed the admin after setting `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in `backend/.env`:

   ```bash
   npm run seed:admin --prefix backend
   ```

6. Start both applications:

   ```bash
   npm run dev
   ```

The frontend runs at `http://localhost:5173`; the API runs at `http://localhost:5000`.

After model or index changes, synchronize development data structures and plan
definitions:

```bash
npm run db:sync-indexes --prefix backend
npm run db:sync-subscription-plans --prefix backend
```

## Family Subscription and Prototype Payments

One Family subscription covers all elderly profiles linked to that account.
Core access preserves stored care information and ongoing-care actions.
Premium unlocks new caregiver bookings and reusable wellness entitlements.

The explicit free trial lasts seven days. Prototype plans are Day Pass,
Monthly, and Yearly, with manual renewal only.

This is not a real payment gateway. Never enter real financial information.
Prototype BDT prices are demonstration values. Configure backend/.env with
PROTOTYPE_PAYMENTS_ENABLED=true, FAMILY_TRIAL_DAYS=7, and
SUBSCRIPTION_CURRENCY=BDT. See FAMILY_SUBSCRIPTION_DOCUMENTATION.md.

Families manage plans and paginated payment history from the Subscription page.
The My account page remains focused on identity and security. Administrators can
review platform-wide payments, generated transaction references, booking history,
and business summary metrics from dedicated admin tabs.

Run subscription verification with:

```bash
npm run test:subscriptions --prefix backend
npm run test:subscriptions:integration --prefix backend
```

## API response convention

Successful endpoints return:

```json
{ "success": true, "data": {} }
```

Failures pass through the shared error middleware:

```json
{
  "success": false,
  "error": {
    "message": "Human-readable explanation",
    "details": null
  }
}
```

## Extending the project

To add an API in an existing feature, define the controller contract and business logic, wrap it with `asyncHandler` in the feature route, then add a frontend service method that returns `response.data.data`. Expose the operation through a focused hook or context before consuming it in a page.

To add a model-backed feature, create the Mongoose schema in `backend/models`, then add its controller, routes, and `app.js` registration. Add the frontend service and a feature hook, and build pages from the shared design-system components.

The authentication onboarding status now queries active `ElderlyFamilyLink` and
`ElderlyProfile` records. Future family invitation work can activate the reserved
editor/viewer permissions without changing the profile document.
