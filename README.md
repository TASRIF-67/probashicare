# ProbashiCare

Identity and Access foundation for a remote elderly-care coordination platform.

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
- Reusable Button, Card, Input, and Modal components
- Responsive light/dark interface with a no-flash persisted preference
- Shared design tokens with a scoped caregiver accent in both light and dark mode

The elderly role remains reserved for a future authentication flow. Caregiver
authentication is now active, but the operational dashboard remains locked until
an administrator approves the initial professional application.

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
