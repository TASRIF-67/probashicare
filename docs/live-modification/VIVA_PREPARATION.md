# Viva Preparation: Assigned Features, Git, and Deployment

This document is an oral-explanation checklist. Answer each question aloud in your own words.

## Universal feature explanation

For every assigned feature, explain:

1. The user and the problem.
2. The frontend page and service.
3. The HTTP method and route.
4. Authentication and role requirements.
5. Controller business logic.
6. Mongoose models and relationships.
7. Validation and errors.
8. External service, if any.
9. Tests and manual verification.
10. Deployment environment variables.

## Elderly Health Profile Management

### One-minute answer

"The family account creates and manages elderly health profiles. ElderlyProfile stores personal and embedded health information. ElderlyFamilyLink stores which family user can access the profile and whether they are owner, editor, or viewer. Creation uses a MongoDB transaction so the profile and owner link are created together. Every read or update first checks the active link through elderlyProfileAccessService. Unauthorized and missing profiles both return 404 to protect privacy. React pages use elderlyProfileService for create, list, get, update, section update, and archive operations."

### Questions

- Why are profile and family access separate collections?
- Why is the owner link created in a transaction?
- What is the difference between owner, editor, and viewer?
- Why does an unauthorized request return 404 instead of 403?
- Why are wellness reports not embedded in ElderlyProfile?
- Why archive instead of delete?
- What validates emergency contact uniqueness?
- Where is the maximum section size enforced?
- How does the frontend convert API dates for HTML date inputs?
- What happens to onboarding after the first profile is created?

## Gemini Wellness Summary

Be ready to explain later:

- What report fields are sanitized before Gemini.
- Why private identifiers should not be included in a prompt.
- Which Gemini model and endpoint are used.
- How malformed Gemini JSON is handled.
- When rule-based fallback runs.
- How the family can tell Gemini from fallback output.
- Why the result is informational and not a diagnosis.
- Which features require Premium access.

## Notifications

Be ready to explain later:

- Notification model fields.
- Recipient user and role.
- Unread count query.
- Mark one and mark all as read.
- Notification links.
- Which controllers produce booking/wellness notifications.
- Why NotificationContext and NotificationBell have different jobs.
- How polling or refresh works.

## Subscription and Payment

Be ready to explain later:

- SubscriptionPlan, FamilySubscription, and SubscriptionPayment roles.
- Trial, monthly, and yearly access.
- Payment transaction reference.
- Pending versus completed payment.
- Stripe Checkout and webhook verification.
- Why the webhook uses a raw request body.
- PremiumFeatureGate.
- Payment-history pagination.
- Admin revenue and transaction analytics.
- Expiry calculation and scheduled checking.

## Family Account and Email Re-verification

Be ready to explain later:

- Why current password is required for email change.
- Why Google-linked accounts are treated differently.
- Why the user becomes unverified after email change.
- Why the session is cleared.
- Verification token hashing and expiry.
- Neutral password-reset responses.
- SMTP provider failures.
- Required Render environment variables.

## Error handling questions

### What is ApiError?

A controlled operational error containing an HTTP status, public message, and optional details.

### What handles unexpected errors?

The shared Express error middleware logs unexpected errors and returns a generic 500 response.

### Why not return database error text?

It can reveal schema, server, or private information.

### What does normalizeApiError do?

It converts Axios, network, and backend error responses into one predictable frontend error shape.

### What happens when an external API fails?

The feature should either use its defined fallback, report a safe error, or keep the main database operation consistent. The exact behavior depends on the feature.

## Database design questions

For every model, know:

- Collection purpose
- Required fields
- Enum fields
- References
- Embedded arrays
- Indexes
- Timestamps
- Status lifecycle
- Which user owns or accesses it

### Index explanation

An index helps MongoDB locate documents efficiently. A unique index also prevents duplicate values or duplicate field combinations.

### Reference versus embedding

Embed bounded information that belongs directly to the parent and is commonly loaded together. Reference growing, shared, transactional, or independently queried data.

## GitHub contribution questions

Useful commands:

~~~powershell
git status --short --branch
git log --oneline --decorate --max-count=20
git show --stat COMMIT_HASH
git diff COMMIT_BEFORE COMMIT_AFTER -- path/to/file
git blame path/to/file
~~~

Explain:

- Which branch you used.
- Which commits contain your feature.
- Which files you primarily authored.
- How conflicts were resolved.
- Which checks ran before merge.
- Why secrets were not committed.

Do not claim every line in a shared file. Explain the exact functions or sections you contributed.

## Deployment explanation

### Frontend

- Hosted on Vercel.
- Vite creates the production bundle.
- VITE_GOOGLE_CLIENT_ID is available to browser code.
- Requests under /api are forwarded to the deployed backend.

### Backend

- Hosted on Render.
- npm start launches server.js.
- Render supplies PORT.
- Environment variables store database and service credentials.
- The free service may sleep and take time to wake.

### Database

- MongoDB Atlas hosts collections.
- MONGODB_URI connects the backend.
- Network access and database user permissions must allow Render.

### Email

- Nodemailer uses configured SMTP.
- Brevo transactional SMTP must be activated.
- Sender address must be verified.
- Password reset and verification links use CLIENT_URL.

### Stripe

- Sandbox keys begin with test-mode prefixes.
- Checkout creates a hosted payment session.
- Stripe sends signed webhook events to Render.
- The webhook secret verifies the event source.
- Premium access activates only after a successful event.

### Gemini

- GEMINI_API_KEY stays on the backend.
- Sanitized report data is sent to Gemini.
- A fallback summary is used when Gemini is unavailable.

## Deployment environment-variable rule

Frontend variables beginning with VITE are public to browser code. Never put database, SMTP, Stripe secret, Gemini secret, or private keys in Vite variables.

Backend secrets belong only in Render environment settings.

## Final viva practice

For each feature, practise:

- 30-second summary
- 2-minute architecture explanation
- One database query
- One error case
- One authorization case
- One change you could implement
- One test
- One deployment variable

If you cannot remember exact syntax, explain the correct flow and show where you would copy the existing pattern from.