# Google Calendar Integration

ProbashiCare can copy saved doctor appointments to one shared Google Calendar.
The appointment is always saved in MongoDB first. Google Calendar is optional,
so missing or incorrect Google configuration does not prevent the family from
using the appointment planner.

## How the current integration works

The backend authenticates with a Google Cloud service account. It writes events
to the calendar identified by GOOGLE_CALENDAR_ID.

This is suitable for the team demo because every appointment can use one shared
ProbashiCare calendar. It does not connect to each family's personal calendar.
Per-family calendar access would require a separate Google OAuth consent flow,
encrypted refresh-token storage, and account-level connect/disconnect controls.

## Required setup

1. Open Google Cloud Console and select the project that owns the service
   account.
2. Enable the Google Calendar API for that project.
3. Create a service account and download a JSON key.
4. Open Google Calendar using the Google account that owns the target calendar.
5. Open the calendar's **Settings and sharing** page.
6. Under **Share with specific people or groups**, add the service account email.
7. Grant **Make changes to events** access.
8. Copy the Calendar ID from the calendar's **Integrate calendar** section.
9. Put the following values in backend/.env:

```env
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@project-id.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nYOUR_KEY_CONTENT\\n-----END PRIVATE KEY-----\\n"
GOOGLE_CALENDAR_ID=calendar-id-from-google-calendar
```

Keep the private key on one line and preserve each literal \\n. Never commit
the real key or add it to .env.example.

## Test access without creating an event

Run:

```powershell
npm.cmd run test:calendar --prefix backend
```

A successful result confirms that the service account can open the configured
calendar. The command performs a read-only access check and does not add or
remove events.

## Understanding HTTP 404

Google Calendar returns 404 Not Found both when the Calendar ID is wrong and
when the authenticated account cannot access that calendar. For example,
GOOGLE_CALENDAR_ID=someone@gmail.com is not enough by itself. That calendar
must also be shared with GOOGLE_SERVICE_ACCOUNT_EMAIL.

After fixing the sharing permission, run the access test again and then restart
the backend so it reloads backend/.env.

## Runtime behavior

- synced: the appointment was saved and the Google event was created.
- disabled: Calendar variables are missing; the appointment remains available
  in ProbashiCare.
- failed: Google rejected the request; the appointment remains available in
  ProbashiCare and the UI shows a configuration notice.

Permanent Google errors such as 404 are not retried. The backend logs a short
safe explanation instead of the full SDK request and authentication details.
