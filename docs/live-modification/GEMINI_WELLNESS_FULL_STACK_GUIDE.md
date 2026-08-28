# Gemini Wellness Summary: Complete Full-Stack Guide

## 1. Requirement

The system analyzes recent submitted wellness reports for an authorized elderly profile. It sends only a strict anonymous whitelist to Gemini. When Gemini succeeds, the system validates and saves a family-friendly, non-diagnostic summary. When Gemini is missing, slow, unavailable, or malformed, a deterministic local fallback is saved instead.

## 2. Important separation

This feature has two different responsibilities:

1. Deterministic wellness rules decide alert categories and severity from configured thresholds.
2. Gemini writes only a readable summary, highlights, and follow-up text.

Gemini never decides whether an alert is low, medium, or high. This keeps health flags predictable and testable.

## 3. Main files

Backend:

- `models/WellnessInsight.js`: saved summary schema.
- `services/geminiWellnessService.js`: privacy whitelist, Gemini call, response validation.
- `services/wellnessInsightService.js`: report analysis, cache, fallback, saving.
- `services/wellnessAnalysisService.js`: deterministic rules and alert upsert.
- `controllers/wellnessInsightController.js`: authorization and HTTP responses.
- `routes/wellnessInsightRoutes.js`: family/premium/validation middleware.
- `test/wellnessInsights.test.js`: privacy, rule, fallback, and provider-failure tests.

Frontend:

- `services/wellnessInsightService.js`: latest/generate Axios requests.
- `services/wellnessAlertService.js`: list/acknowledge/resolve requests.
- `components/wellness/WellnessInsightsPanel.jsx`: family UI.
- `pages/elderly/ElderlyWellnessPage.jsx`: profile page that contains the panel.

## 4. API contract

### Get latest saved insight

~~~http
GET /api/elderly-profiles/:profileId/wellness-insights/latest
~~~

Required checks, in order:

1. Authenticated session.
2. User role is family.
3. Family has `WELLNESS_AI_SUMMARY` entitlement.
4. `profileId` is a valid ObjectId.
5. Family has active owner/editor/viewer link to the profile.

Success:

~~~json
{
  "success": true,
  "data": {
    "insight": null
  }
}
~~~

Or `insight` contains the latest saved document.

### Generate or refresh insight

~~~http
POST /api/elderly-profiles/:profileId/wellness-insights/generate
~~~

No request body is required. The profile ID is in route params and the user comes from authentication middleware.

Success:

~~~json
{
  "success": true,
  "data": {
    "insight": {
      "summary": "...",
      "highlights": ["..."],
      "recommendedFollowUp": "...",
      "generatedBy": "gemini"
    },
    "generatedBy": "gemini",
    "reused": false
  }
}
~~~

`generatedBy` is `gemini` or `fallback`. `reused` is true only when an unchanged recent Gemini result is reused during cooldown.

## 5. Complete generation flow

~~~text
Family clicks Generate summary
  -> WellnessInsightsPanel.generate
  -> wellnessInsightService.generateInsight(profileId)
  -> POST route
  -> requireAuth
  -> allowRoles("family")
  -> requireFamilyEntitlement(WELLNESS_AI_SUMMARY)
  -> validateObjectIdParameter
  -> controller generateInsight
  -> getAuthorizedElderlyProfile
  -> generateWellnessInsight
  -> analyzeRecentWellnessReports
  -> WellnessReport.find(submitted only, newest first, limited)
  -> buildReportSignature
  -> recent Gemini cache query
  -> sanitizeReportsForGemini
  -> Gemini HTTP request
       success -> validate provider JSON
       failure -> buildFallbackWellnessSummary
  -> WellnessInsight.create
  -> controller JSON
  -> Axios response.data.data
  -> React setInsight
  -> provider-aware toast and rerender
~~~

## 6. Privacy whitelist

Gemini receives only:

- Sequence number, not report ID.
- Visit date.
- Mood enum.
- Meal-status enum.
- Medicine-intake enum.
- Systolic and diastolic values with unit.
- Blood-sugar value/context with unit.
- Weight with unit.
- Exercise duration.

It does not receive:

- Elderly profile ID.
- Wellness report ID.
- Elderly name.
- Family identity.
- Caregiver identity.
- Email, phone, or address.
- Caregiver free-text observations.
- Medical history or emergency contacts.

The sanitizer builds a new object. It does not delete fields from the original report; unlisted fields are never copied.

## 7. Gemini request logic

`GEMINI_API_KEY` comes from backend environment configuration. `GEMINI_MODEL` has a configured default.

The service:

1. Returns null immediately when no key exists.
2. Sanitizes reports.
3. Uses `JSON.stringify` to place anonymous data in the prompt.
4. Defines a structured response schema.
5. Creates `AbortController` and a 12-second timeout.
6. URL-encodes the model name.
7. Sends POST to Gemini `generateContent`.
8. Checks `response.ok`.
9. Parses provider JSON.
10. Finds generated text safely.
11. Parses that text as JSON.
12. Validates type, required fields, whitespace, array shape, item count, and length.
13. Returns null for every provider/network/timeout/JSON failure.
14. Always clears the timeout in `finally`.

Returning null is intentional. It tells the orchestration service to use fallback rather than failing the family workflow.
## 8. Fallback logic

`buildFallbackWellnessSummary` receives reports and deterministic rule results. It always returns the same shape as Gemini:

~~~js
{
  summary,
  highlights,
  recommendedFollowUp,
}
~~~

It counts submitted reports, uses rule titles as highlights, limits highlights to five, and changes follow-up wording when rules were triggered. It remains non-diagnostic.

Because both providers share one shape, the model, controller, and frontend do not need separate rendering logic.

## 9. Cache and report signature

The signature is made by:

1. Converting each report ObjectId to text.
2. Sorting the ID strings.
3. Joining them with commas.

Sorting means the same reports produce the same signature even if their array order changes.

The cache query requires:

- Same elderly profile.
- Same report signature.
- `generatedBy: "gemini"`.
- `generatedAt >= cooldownStart`.

The cooldown is ten minutes. A recent Gemini result is reused. A fallback is not reused by this cache, so a later refresh can try Gemini again.

## 10. Database design

`WellnessInsight` stores:

- `elderlyProfileId`: owning profile reference.
- `reportIds`: traceable source reports.
- `reportSignature`: cache identity.
- `periodStart` and `periodEnd`: covered dates.
- `summary`: bounded family text.
- `highlights`: maximum validated source items, each bounded.
- `recommendedFollowUp`: bounded follow-up text.
- `generatedBy`: `gemini` or `fallback`.
- `generatedAt`, `createdAt`, `updatedAt`: audit times.

Indexes support newest-by-profile and cache-signature queries. The source IDs allow the system to explain which reports contributed without sending those IDs to Gemini.

## 11. Deterministic wellness rules

Only submitted reports are included. Current analyzers cover:

- Repeated high/low blood pressure.
- Repeated high/low blood sugar.
- Percentage weight change.
- Repeated missed/partial medicine.
- Repeated missed/partial meals.
- Repeated low/distressed mood.

`analyzeAndCreateWellnessAlerts` builds a stable dedupe key and uses `findOneAndUpdate` with `upsert`. `$setOnInsert` creates the alert only when it is missing. A unique dedupe index is the final concurrent-duplicate protection.

## 12. Authorization and premium access

The route verifies premium entitlement before the controller. The controller then verifies profile-level owner/editor/viewer access. Both are required:

- Premium answers whether the family plan unlocks AI summary.
- Elderly link answers whether this family may see this person's data.

The access service uses concealed 404 behavior so an unrelated family cannot discover a private profile.

## 13. Frontend state

The panel keeps separate state for:

- Alerts, pagination, filters, loading, and error.
- Saved insight, loading, generation loading, and error.
- Busy alert ID.
- Selected resolving alert and resolution note.

Two effects are separate because loading alerts depends on filters/page, while loading the saved insight depends only on profile ID.

The Generate button uses `generatingInsight` for loading. Provider feedback is:

- Gemini success: summary generated.
- Reused Gemini: saved summary is current.
- Fallback: Gemini unavailable; rule-based summary created.

## 14. Expected failures

- 401: user is not signed in.
- 403: wrong role or missing premium entitlement.
- Concealed 404: profile missing or family not linked.
- 422: no submitted wellness report exists.
- Gemini unavailable: endpoint still succeeds using fallback.
- Malformed Gemini JSON: endpoint still succeeds using fallback.
- Database failure: centralized backend error handling returns failure.

Do not send raw Gemini errors, prompts, keys, or private report values to the browser.

## 15. Live modification exercise: show source report count

Requirement: Display how many reports contributed to a generated summary without changing the schema.

The data already exists in `insight.reportIds`, so no new collection query is needed.

Controller response:

~~~js
const reportCount = result.insight.reportIds.length;

response.json({
  success: true,
  data: {
    insight: result.insight,
    reportCount,
    generatedBy: result.insight.generatedBy,
    reused: result.reused,
  },
});
~~~

Frontend service already returns the whole `data` object, so no change is needed there.

React state option:

~~~js
const [reportCount, setReportCount] = useState(0);

const data = await wellnessInsightService.generateInsight(profileId);
setInsight(data.insight);
setReportCount(data.reportCount);
~~~

Render:

~~~jsx
<p>
  Built from {reportCount} submitted reports.
</p>
~~~

Explain it aloud:

"The source IDs were already stored on the insight, so I derived the count instead of adding redundant database data. Authorization still happens before generation. The controller added one backward-compatible response field, the existing frontend service passed it through, and React stored and displayed it."

## 16. Tests to remember

- Sanitizer output excludes ID, name, and free-text notes.
- Units remain explicit.
- Drafts do not create rule findings.
- Repeated submitted readings do create findings.
- Fallback contains non-diagnostic language.
- Missing key does not call fetch.
- Malformed provider output returns null.

Useful commands:

~~~powershell
node --check backend/services/geminiWellnessService.js
node --check backend/services/wellnessInsightService.js
node --test backend/test/wellnessInsights.test.js
npm.cmd run build --prefix frontend
~~~

## 17. Viva answers

Why sanitize before Gemini?

To use a strict allow-list. Removing known private fields is weaker because a newly added field could accidentally be sent later.

Why validate Gemini output?

External output is untrusted. Structured JSON can still be missing, malformed, too long, or wrong type.

Why have fallback?

The external provider should improve wording but must not make the care-monitoring workflow unavailable.

Why is Gemini not used for severity?

Health flags need deterministic thresholds that can be tested and explained. AI wording is non-diagnostic presentation only.

Why save insights?

Families can reopen the latest result, the system keeps provider/source/date audit context, and repeated requests can reuse a current result.