# ProbashiCare Local Setup and Run Guide

This guide explains how to prepare and run the ProbashiCare frontend and backend
on a Windows development machine using PowerShell.

## 1. Requirements

Install the following before starting:

- Node.js 20 or newer
- npm, included with Node.js
- A MongoDB Atlas account and cluster
- Git, if the project is being cloned from a repository

Check the installed versions:

```powershell
node --version
npm.cmd --version
```

This guide uses `npm.cmd` because some Windows PowerShell configurations block
the `npm.ps1` script. If `npm` works normally on your computer, either form is
acceptable.

## 2. Open the project directory

In PowerShell:

```powershell
cd F:\cse471-project\probashicare
```

If the project is stored elsewhere, replace the path with your local project
location.

## 3. Install dependencies

Install the root development dependency:

```powershell
npm.cmd install
```

Install backend and frontend dependencies:

```powershell
npm.cmd run install:all
```

This installs packages into:

```text
probashicare/node_modules
probashicare/backend/node_modules
probashicare/frontend/node_modules
```

Dependencies normally need to be installed only after cloning the project or
after `package.json` changes.

## 4. Backend environment

The backend reads:

```text
probashicare/backend/.env
```

Use the following structure:

```env
NODE_ENV=development
PORT=5000
CLIENT_URL=http://localhost:5173

MONGODB_URI=your-mongodb-atlas-connection-string

JWT_SECRET=your-development-session-secret
JWT_EXPIRES_IN=7d

GOOGLE_CLIENT_ID=

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM=ProbashiCare <no-reply@probashicare.local>

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
REQUIRE_CAREGIVER_DOCUMENT=false

ADMIN_NAME=Platform Administrator
ADMIN_EMAIL=admin@probashicare.local
ADMIN_PASSWORD=your-development-admin-password
```

Do not commit `.env`. It contains database credentials and session secrets.

### Cloudinary document storage

Cloudinary is prepared for caregiver ID and verification-document uploads. You
may leave all three Cloudinary values empty while working on other screens. With
`REQUIRE_CAREGIVER_DOCUMENT=false`, caregivers can save drafts and submit their
application without a document. Attempting an upload still returns a clear
configuration error until Cloudinary credentials are added.

When you are ready, copy the cloud name, API key, and API secret from your
Cloudinary dashboard into `backend/.env`, change
`REQUIRE_CAREGIVER_DOCUMENT=true`, then restart the backend. Uploaded documents
are stored as authenticated assets and admin preview links expire after ten
minutes.

### MongoDB Atlas requirements

In MongoDB Atlas:

1. Create a database user under **Security → Database Access**.
2. Give the user read/write access to the development database.
3. Open **Security → Network Access**.
4. Add the current development machine's IP address.
5. Copy the Atlas connection string into `MONGODB_URI`.

If the database password contains special URL characters, use its URL-encoded
form in the connection string.

## 5. Frontend environment

The frontend reads:

```text
probashicare/frontend/.env
```

Use:

```env
VITE_API_URL=http://localhost:5000/api
VITE_GOOGLE_CLIENT_ID=
```

Google authentication is optional during local email/password testing. To enable
it, create a Google OAuth Web Client ID and place the same value in:

```text
backend/.env → GOOGLE_CLIENT_ID
frontend/.env → VITE_GOOGLE_CLIENT_ID
```

Add this authorized JavaScript origin in Google Cloud:

```text
http://localhost:5173
```

Restart the frontend after changing `frontend/.env`.

## 6. Synchronize database indexes

Run this after initially configuring Atlas or after a model index changes:

```powershell
npm.cmd run db:sync-indexes --prefix backend
```

The current setup uses a partial unique index for Google IDs so email/password
accounts can safely keep `googleId` as `null`.

## 7. Create the development admin

Confirm the `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` values in
`backend/.env`, then run:

```powershell
npm.cmd run seed:admin --prefix backend
```

This command can be run again to update the configured admin account. Public
admin signup is intentionally unavailable.

## 8. Run frontend and backend together

From the project root:

```powershell
cd F:\cse471-project\probashicare
npm.cmd run dev
```

This starts:

```text
Frontend: http://localhost:5173
Backend:  http://localhost:5000
API:      http://localhost:5000/api
```

Keep this terminal open while using the application.

Stop both servers with:

```text
Ctrl+C
```

## 9. Run frontend and backend separately

Separate terminals make backend logs and frontend messages easier to read.

### Terminal 1: backend

```powershell
cd F:\cse471-project\probashicare
npm.cmd run dev --prefix backend
```

Expected output:

```text
ProbashiCare API listening on port 5000
```

### Terminal 2: frontend

```powershell
cd F:\cse471-project\probashicare
npm.cmd run dev --prefix frontend
```

Expected output includes:

```text
Local: http://localhost:5173/
```

Open the frontend URL in a browser.

## 10. Email signup in development

SMTP is optional in development. When SMTP settings are empty:

1. Open `http://localhost:5173/signup`.
2. Create a family account.
3. Look in the backend terminal for:

   ```text
   Development verification link for name@example.com: http://localhost:5173/verify-email?token=...
   ```

4. Copy the complete link into the browser.
5. After verification, return to the login page.
6. Sign in with the new account.

Verified families without an active elderly profile are redirected to onboarding.

Caregiver email verification uses the same flow. Start at
`http://localhost:5173/caregiver/signup`; after verification, login sends the
caregiver to the application form rather than a family page.

The Family/Caregiver control in the signup header swaps account type without a
page reload. Google signup is intentionally Family-only. Caregivers must use the
caregiver form so their phone number, password verification, and mandatory email
verification are captured before application review.

## 11. Available application routes

```text
/signup                         Family account creation
/login                          Family, caregiver, and seeded-admin login
/caregiver/signup               Caregiver account creation
/caregiver/application          Draft or rejected application editor
/caregiver/application-status   Submitted/suspended holding page
/caregiver/dashboard            Approved caregiver dashboard
/caregiver/profile              Approved caregiver profile editor
/caregiver/wellness-reports     Caregiver-owned draft and submitted reports
/caregiver/wellness-reports/new New assigned-visit wellness report
/verify-email                   Email verification result
/onboarding                     First elderly-profile prompt
/elderly-profiles/new           Create an elderly profile
/elderly-profiles               List linked active profiles
/elderly-profiles/:profileId    Profile details
/elderly-profiles/:profileId/edit
/elderly-profiles/:profileId/wellness
/dashboard                      Family dashboard
/admin                          Live admin overview
/admin/accounts                 Family account management
/admin/caregivers               Caregiver application queue
/admin/caregivers/:profileId    Caregiver review and decision
```

## 12. Verification commands

Build the frontend:

```powershell
npm.cmd run build --prefix frontend
```

Run the elderly-profile API smoke test while the backend is running:

```powershell
npm.cmd run test:elderly-profiles --prefix backend
```

That test creates temporary family and profile records, confirms onboarding and
ownership isolation, archives the profile, and removes its records afterward.

Run the admin family-account management smoke test:

```powershell
npm.cmd run test:admin-users --prefix backend
```

Run the complete caregiver application-state smoke test:

```powershell
npm.cmd run test:caregiver-applications --prefix backend
```

This caregiver test uses an ephemeral local API, creates a temporary verified
caregiver, and checks draft saving, document-optional submission, admin rejection,
resubmission, approval, and approved-profile editing. It removes
its temporary records afterward and does not call Cloudinary.

Run the daily wellness report and vitals authorization smoke test:

```powershell
npm.cmd run test:wellness-reports --prefix backend
```

This test creates isolated temporary family, elderly, approved-caregiver, care-
assignment, and wellness records. It checks draft privacy, submission locking,
linked-family visibility, vitals trends, and unrelated-account denial, then
removes every temporary record.

Caregiver report creation requires a `CareAssignment`. The Caregiver Booking
feature should call `syncCareAssignmentFromBooking` after booking creation and
every schedule or status change. Until booking produces that projection, the
caregiver report editor intentionally shows that no reportable visits exist.

Check the API health endpoint in PowerShell:

```powershell
Invoke-RestMethod http://localhost:5000/api/health
```

Expected result:

```text
success data
------- ----
   True @{status=ok}
```

## 13. Common problems

### PowerShell blocks `npm`

Use:

```powershell
npm.cmd run dev
```

instead of:

```powershell
npm run dev
```

### MongoDB connection is rejected

Check:

- The Atlas IP allowlist contains the current IP.
- The database username and password are correct.
- The password is URL-encoded in `MONGODB_URI`.
- The cluster is running.

### Port 5000 or 5173 is already in use

Stop an older development-server terminal with `Ctrl+C`. If the project is
already running, use the existing browser URL instead of starting another copy.

### Signup says the account already exists

Use a different email or sign in with the existing verified account. If the
existing account is unverified, use its latest development verification link.

### Delete a test family account

Sign in with the seeded admin and open `/admin/accounts`. The family account list provides
a Delete action for accounts without linked elderly profiles. Accounts with
health-record links are protected from deletion to avoid orphaning those records.

### The verification email does not arrive

With empty SMTP configuration, no real email is sent. Use the verification link
printed in the backend terminal.

### Google sign-in is unavailable

Configure the same OAuth Web Client ID in both environment files and restart both
servers.

### Caregiver document upload says it is not configured

Add all three `CLOUDINARY_*` values to `backend/.env` and restart the backend.
For the current development phase, leave `REQUIRE_CAREGIVER_DOCUMENT=false` and
submit without uploading. Set it to `true` after Cloudinary integration is ready.

## Gemini development setup

Create a development Gemini API key in Google AI Studio and add GEMINI_API_KEY
only to backend/.env. GEMINI_MODEL is optional and defaults to
gemini-flash-lite-latest. Restart the backend after changing environment values.

The key is optional. Missing keys, quota limits, timeouts, provider failures, and
malformed responses use the local fallback summary. Do not put the key in a VITE_
variable. Free-tier requests must contain only synthetic or anonymized wellness
values; the implemented sanitizer removes identities, database IDs, contact
information, medical-history text, and unrestricted notes.

## 14. Normal daily workflow

After the initial setup, most development sessions require only:

```powershell
cd F:\cse471-project\probashicare
npm.cmd run dev
```

Then open:

```text
http://localhost:5173
```
