# Gemini Wellness Insights Integration

This guide explains how ProbashiCare uses Gemini to create a wellness summary
for linked family members. It covers the request flow, APIs, privacy rules,
fallback behavior, testing, and troubleshooting.

## 1. Feature purpose

Caregivers submit daily wellness reports for an elderly person. A linked family
member can request a summary of recent submitted reports.

The generated result contains:

- A short overview of the recorded wellness information.
- Up to five important highlights.
- A suggested follow-up action.
- The date range covered by the reports.
- A source value of `gemini` or `fallback`.

This feature is informational. It does not diagnose a disease and does not
replace advice from a qualified healthcare professional.

## 2. Alerts and AI insights are different

### Deterministic wellness alerts

The backend checks submitted reports using fixed rules. For example, repeated
high blood-pressure readings may create an alert. These rules do not use AI.
They are configured in:

```text
backend/config/wellnessAlertRules.js
```

### Gemini wellness insights

Gemini receives a small, anonymized set of wellness values and writes a
readable summary. Gemini does not decide alert severity. The deterministic
backend rules remain the source of truth for alerts.

## 3. Files involved

### Backend

| File | Responsibility |
| --- | --- |
| `backend/config/env.js` | Reads the Gemini key and model. |
| `backend/services/geminiWellnessService.js` | Removes private fields, calls Gemini, and validates the response. |
| `backend/services/wellnessInsightService.js` | Handles reports, caching, Gemini, fallback creation, and persistence. |
| `backend/services/wellnessAnalysisService.js` | Loads recent submitted reports and runs deterministic rules. |
| `backend/controllers/wellnessInsightController.js` | Handles authenticated family requests. |
| `backend/routes/wellnessInsightRoutes.js` | Defines family-only endpoints. |
| `backend/models/WellnessInsight.js` | Stores generated summaries. |
| `backend/models/WellnessAlert.js` | Stores deterministic alerts. |
| `backend/test/wellnessInsights.test.js` | Tests sanitization, rules, fallback, and provider errors. |

### Frontend

| File | Responsibility |
| --- | --- |
| `frontend/src/services/wellnessInsightService.js` | Calls the insight endpoints. |
| `frontend/src/services/wellnessAlertService.js` | Calls the alert endpoints. |
| `frontend/src/components/wellness/WellnessInsightsPanel.jsx` | Displays alerts and summaries and handles Generate or Refresh. |
| `frontend/src/pages/elderly/ElderlyWellnessPage.jsx` | Includes the insights panel on the wellness page. |

## 4. Environment setup

Put the private configuration in `backend/.env`:

```env
GEMINI_API_KEY=PASTE_THE_PRIVATE_KEY_HERE
GEMINI_MODEL=gemini-flash-lite-latest
```

Security rules:

- Never add the real key to `.env.example`.
- Never add it to frontend code or a frontend environment variable.
- Never use a variable beginning with `VITE_` for this key.
- Never commit or share the key.
- Restart the backend after changing `.env`.

The model has a default in `backend/config/env.js`. Keeping it in `.env` makes
it easier to change if Google retires a model.

## 5. ProbashiCare API endpoints

All endpoints require authentication and the `family` role. The family user
must also have authorized access to the elderly profile.

### Read the latest saved insight

```http
GET /api/elderly-profiles/:profileId/wellness-insights/latest
```

This reads the most recently saved insight. It does not call Gemini.

### Generate or refresh an insight

```http
POST /api/elderly-profiles/:profileId/wellness-insights/generate
```

This endpoint may call Gemini. A simplified successful response is:

```json
{
  "success": true,
  "data": {
    "insight": {
      "summary": "Recorded wellness information remained generally stable.",
      "highlights": [
        "Meals and medicine were recorded as completed."
      ],
      "recommendedFollowUp": "Continue reviewing future reports.",
      "generatedBy": "gemini",
      "periodStart": "2026-08-01T00:00:00.000Z",
      "periodEnd": "2026-08-10T00:00:00.000Z",
      "generatedAt": "2026-08-10T12:00:00.000Z"
    },
    "generatedBy": "gemini",
    "reused": false
  }
}
```

If no submitted reports exist, the endpoint returns status `422` and the
message `A submitted wellness report is required.`

### Deterministic alert endpoints

These endpoints do not use Gemini:

```http
GET /api/elderly-profiles/:profileId/wellness-alerts
GET /api/wellness-alerts/:alertId
PATCH /api/wellness-alerts/:alertId/acknowledge
PATCH /api/wellness-alerts/:alertId/resolve
```

## 6. External Gemini API

The backend sends a server-to-server request to:

```http
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
```

It sends these important headers:

```http
Content-Type: application/json
x-goog-api-key: THE_SERVER_SIDE_API_KEY
```

The browser never calls Google directly. It calls the ProbashiCare backend,
and the backend calls Google. Therefore the key does not appear in frontend
JavaScript or browser requests.

Gemini is asked to return structured JSON:

```json
{
  "summary": "string",
  "highlights": ["string"],
  "recommendedFollowUp": "string"
}
```

The backend validates this structure. Invalid JSON, missing fields, empty
required strings, provider errors, and timeouts activate the safe fallback.

## 7. Complete request flow

1. A caregiver submits a wellness report.
2. The report is stored with `submitted` status.
3. The backend runs deterministic alert rules.
4. A linked family user opens the elderly wellness page.
5. The frontend loads the latest saved insight without calling Gemini.
6. The family user selects Generate or Refresh.
7. The frontend posts to the ProbashiCare generation endpoint.
8. The controller checks authentication, role, and elderly-profile access.
9. The service loads recent submitted reports and deterministic rule results.
10. It creates a stable signature from the included report IDs.
11. A recent successful Gemini result for the same signature may be reused.
12. Otherwise, private data is removed and anonymous values go to Gemini.
13. The Gemini response is parsed and validated.
14. A valid result is saved with `generatedBy: "gemini"`.
15. A provider failure creates a local result with `generatedBy: "fallback"`.
16. The API returns the saved insight and the frontend displays it.

## 8. Privacy protection

Only these whitelisted values are sent to Gemini:

- Report sequence and date.
- Mood status.
- Meal status.
- Medicine-intake status.
- Blood pressure with the `mmHg` unit.
- Blood sugar with the `mg/dL` unit and measurement context.
- Weight with the `kg` unit.
- Exercise duration in minutes.

These values are not sent:

- Database IDs.
- Names, emails, or phone numbers.
- Home addresses or emergency contacts.
- Caregiver identity.
- Free-text health observations.
- Authentication tokens.

The prompt tells Gemini not to diagnose conditions, claim certainty, or change
the severity of deterministic alerts.

## 9. Caching and Refresh

The application creates a report signature using the IDs of the submitted
reports included in the summary.

If the same report set has a recent successful Gemini insight, the backend may
return it with `generatedBy: "gemini"` and `reused: true`. This avoids repeated
provider calls when a user clicks the button several times.

A fallback is not reused by the generation cache. Selecting Refresh after a
fallback makes another Gemini attempt. This allows the feature to recover
after its API key or model configuration is corrected.

## 10. Fallback behavior

A rule-based summary is used when:

- The Gemini key is missing.
- The model is unavailable.
- Free quota or rate limits are exceeded.
- Google rejects the request.
- The network fails.
- The 12-second request timeout is reached.
- Gemini returns malformed structured output.

The fallback describes the number of submitted reports and lists triggered
deterministic alert titles. It does not call another provider.

The frontend message `Gemini was unavailable. A rule-based summary was
created.` means the feature completed, but Gemini did not return a usable
result.

## 11. Test the workflow manually

### Create test reports

1. Start MongoDB, the backend, and frontend.
2. Sign in as a caregiver.
3. Open wellness reports.
4. Create a report for an assigned elderly profile.
5. Enter synthetic test values.
6. Submit it instead of saving only a draft.
7. Add more submitted reports if you want a trend summary.

Do not use real identifying or sensitive medical data for AI testing.

### Generate the summary

1. Sign in as a linked family user.
2. Open the elderly wellness page.
3. Find Family wellness summary.
4. Select Generate summary.
5. Confirm the source says `Generated by gemini`.
6. Review the summary, highlights, date range, and follow-up guidance.

### Test fallback recovery

1. Temporarily remove `GEMINI_API_KEY` from `backend/.env`.
2. Restart the backend and generate a summary.
3. Confirm a fallback is displayed.
4. Restore the key and restart the backend.
5. Select Refresh and confirm Gemini is attempted again.

## 12. Automated verification

Run the focused backend tests:

```powershell
npm.cmd run test:wellness-insights --prefix backend
```

The tests cover:

- Anonymous field whitelisting.
- Exclusion of draft reports.
- Repeated-reading deterministic rules.
- Rule-based fallback output.
- Missing Gemini keys.
- Malformed Gemini responses.

Run the frontend build:

```powershell
npm.cmd run build --prefix frontend
```

Check whitespace and patch integrity:

```powershell
git diff --check
```

## 13. Troubleshooting checklist

If Gemini is unavailable, check these items in order:

1. The key is in `backend/.env`.
2. Its name is exactly `GEMINI_API_KEY`.
3. The model is `gemini-flash-lite-latest`.
4. The backend was restarted after changing `.env`.
5. At least one report has `submitted` status.
6. The backend terminal does not show a provider error.
7. Google AI Studio shows that the key is active.
8. Google AI Studio usage has not reached a quota or rate limit.
9. The key is allowed to access the Gemini API.
10. Refresh is selected again after correcting the configuration.

Other API results:

- `401`: authentication is missing or invalid.
- `403`: the account does not have the Family role.
- Concealed not-found response: the account may not be linked to the profile.
- `422`: no submitted wellness report exists for the profile.
- `reused: true`: a recent successful result for the same reports was reused.

## 14. Limitations

- This feature is not a medical device.
- Demonstration thresholds need professional review before clinical use.
- AI text may still be incomplete or inaccurate.
- Health concerns require a qualified healthcare professional.
- Urgent situations must use the proper emergency process, not an AI summary.
- Free-tier quotas and model availability can change.

## 15. Safe future improvements

- Store a non-sensitive provider error category for administrators.
- Add a provider-health indicator.
- Add integration tests using a mocked Gemini HTTP server.
- Display whether a summary was newly generated or reused more clearly.
- Make the cooldown configurable through backend environment settings.
- Use professionally reviewed thresholds before production clinical use.

Future changes must keep the API key on the backend and preserve the strict
privacy whitelist.
