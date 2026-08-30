# Start Here: Live Modification Problem-Solving Guide

Open this file before the longer feature guides. The goal is not to memorize the repository. The goal is to trace one existing request, change the smallest responsible parts, and verify the complete flow.

## 1. First five minutes: do not code yet

Rewrite the question using this worksheet:

~~~text
User and permission:
Action:
Data needed:
Collection or source:
Inputs (params, query, body, authenticated user):
Expected response:
Page/component:
Behavior that must remain:
Error cases:
~~~

Then fill in these five implementation lines:

~~~text
1. Model or collection:
2. Controller function:
3. Express route:
4. Frontend service function:
5. React page or component:
~~~

Example requirement:

> Show the authenticated family's emergency contacts from another collection, three at a time.

Becomes:

~~~text
1. Model: ElderlyEmergencyContact
2. Controller: listEmergencyContacts
3. Route: GET /elderly-profiles/:profileId/emergency-contacts
4. Service: elderlyProfileService.listEmergencyContacts
5. Page: ElderlyProfileDetailPage
~~~

If the five lines are unclear, find the existing flow before writing code.

## 2. Trace one existing flow

For a visible frontend behavior, trace backwards:

~~~text
React page/component
  -> frontend service
  -> HTTP method and URL
  -> Express route and middleware
  -> controller
  -> Mongoose model/query
  -> MongoDB
~~~

For a backend question, trace forwards from the route until the JSX that consumes its response.

Useful searches:

~~~powershell
git status --short --branch
rg -n "Visible text from the page" frontend/src
rg -n "existingFunctionName" frontend/src backend
rg -n "elderly-profiles" backend/routes frontend/src/services
rg -n "ModelName.find" backend/controllers backend/services
~~~

Search for one distinctive page label, function, URL segment, model, or response field. Do not read every file.

## 3. Convert requirement words into code targets

| Wording | Backend target | Frontend target |
| --- | --- | --- |
| Show/list | GET route and `find` | service GET, effect, render |
| Show one | `findOne`/`findById` | route param, detail state |
| Add/create | validation and `create` | form state, POST |
| Edit/update | PATCH/PUT and `$set`/save | handler, request body |
| Remove | delete or archive/status | confirmation action |
| Filter | `request.query`, filter object | input/select, service params |
| Count | `countDocuments`/aggregation | summary card |
| Paginate | page, limit, skip, count | Pagination component |
| Another collection | `populate` or second query | render related response |
| Current user only | `request.user._id` in query | no user ID input |
| Prevent duplicate | unique index/conditional query | conflict message |
| Concurrent safety | atomic condition/transaction | disable repeated action |
| External API | integration service and fallback | loading/error/retry UI |

Do not create a new route when an existing route already owns the same operation.

## 4. Write the API contract first

Write one concrete request:

~~~text
Method: GET
URL: /api/elderly-profiles/:profileId/emergency-contacts
Params: profileId
Query: page, limit
Body: none
Auth: family owner/editor/viewer
Success: 200
Failures: validation error or concealed 404
~~~

Write the exact response:

~~~json
{
  "success": true,
  "data": {
    "contacts": [],
    "pagination": {
      "page": 1,
      "limit": 3,
      "total": 0,
      "pages": 0
    }
  }
}
~~~

The route, controller, service, and component must use identical names. Code can compile while still failing because the controller returns `contacts` and React reads `records`.

## 5. Know where input comes from

~~~js
const profileId = request.params.profileId;
const page = request.query.page;
const contacts = request.body.contacts;
const currentUserId = request.user._id;
~~~

- `params`: values inside the route, such as `/:profileId`.
- `query`: optional values after `?`, such as `?page=2`.
- `body`: submitted JSON for POST, PUT, or PATCH.
- `user`: trusted identity added by authentication middleware.

Never trust a user/owner ID from the body when `request.user._id` identifies the signed-in user.

## 6. Backend order

1. Confirm or modify the Mongoose schema.
2. Reuse or add validation.
3. Import the model into the controller.
4. Authorize before loading private data.
5. Build the database filter.
6. Execute the query/mutation.
7. Return the agreed response shape.
8. Register the route with existing middleware.
9. Test the endpoint before writing React.

Minimal controller pattern:

~~~js
export async function listRecords(request, response) {
  const records = await Example.find({
    ownerUserId: request.user._id,
  })
    .sort({ createdAt: -1 })
    .lean();

  response.json({
    success: true,
    data: {
      records,
    },
  });
}
~~~

Minimal route pattern:

~~~js
router.get(
  "/examples",
  asyncHandler(requireAuth),
  allowRoles("family"),
  asyncHandler(listRecords),
);
~~~

Explain aloud which line authenticates, which condition enforces ownership, what MongoDB returns, and what JSON React receives.

## 7. When a new schema is required

A separate model is useful when records:

- grow independently;
- need individual timestamps/statuses;
- need independent filtering or pagination;
- form a many-to-one relationship;
- would make the parent document keep growing.

Relationship pattern:

~~~js
elderlyProfileId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "ElderlyProfile",
  required: true,
  index: true,
}
~~~

Plan for existing documents:

1. Read from the new collection.
2. Temporarily fall back to the legacy field if necessary.
3. Run a migration that copies legacy data.
4. Verify old and new counts/values.
5. Remove the fallback only after verification.

MongoDB does not automatically move existing document data when a schema changes.

## 8. Data from another collection

Use `populate` when a stored ObjectId has a matching `ref` and only a few related fields are required:

~~~js
const bookings = await Booking.find({
  familyMemberId: request.user._id,
})
  .populate("caregiverId", "name")
  .lean();
~~~

Use another query for independent authorization, filtering, pagination, or response construction:

~~~js
await getAuthorizedElderlyProfile({
  profileId: request.params.profileId,
  familyUserId: request.user._id,
});

const contacts = await ElderlyEmergencyContact.find({
  elderlyProfileId: request.params.profileId,
})
  .sort({ isPrimary: -1, createdAt: -1 })
  .lean();
~~~

Authorize the parent before querying private child records.

## 9. Frontend order

1. Write the service function.
2. Match its HTTP method, URL, query, and body to the route.
3. Add state for data, loading, and error.
4. Call the service in a named handler or an inner async effect function.
5. Render loading.
6. Render error.
7. Render empty data.
8. Render success.
9. Add pagination/actions last.

Service pattern:

~~~js
async function listRecords(options = {}) {
  const response = await api.get("/examples", {
    params: {
      page: options.page || 1,
    },
  });

  return response.data.data;
}
~~~

Effect pattern:

~~~jsx
useEffect(() => {
  let active = true;

  async function loadRecords() {
    setLoading(true);
    setError("");

    try {
      const data = await exampleService.listRecords();

      if (active) {
        setRecords(data.records || []);
      }
    } catch (requestError) {
      if (active) {
        const error = normalizeApiError(requestError);
        setError(error.message);
      }
    } finally {
      if (active) {
        setLoading(false);
      }
    }
  }

  loadRecords();

  return function stopLateUpdates() {
    active = false;
  };
}, []);
~~~

Never pass an async function directly to `useEffect`; an effect may return only a cleanup function or `undefined`, not a Promise.

## 10. Copy the nearest working pattern safely

Search targets:

| Need | Search |
| --- | --- |
| Elderly authorization | `getAuthorizedElderlyProfile` |
| Pagination | `parsePagination` or `<Pagination` |
| Current-user query | `request.user._id` |
| Atomic update | `findOneAndUpdate` |
| Transaction | `startSession` and `withTransaction` |
| Backend error | `throw new ApiError` |
| Frontend error | `normalizeApiError` |
| Safe loading effect | `let active = true` |
| API request | `const response = await api` |

Copy structure, then replace one category at a time:

1. Model.
2. URL.
3. params/query/body.
4. database fields.
5. response fields.
6. UI labels.

Test after small changes instead of replacing everything at once.

## 11. Debug by symptom

| Symptom | First check |
| --- | --- |
| Route 404 | method, URL, route mount/order |
| 401 | token/cookie and `requireAuth` |
| 403 | role/permission middleware |
| Concealed 404 | access-link IDs and status |
| 422 | body/query names and validation |
| 500 | backend stack trace |
| Saved but not shown | response name and React state name |
| Field disappears | schema path versus request nesting |
| React crash | browser console and undefined properties |
| Repeating requests | effect dependency and state changes |
| Effect cleanup error | async function passed directly to effect |
| Empty related records | wrong ObjectId, collection, or missing migration |

Trace one boundary at a time:

~~~text
Browser request -> route -> controller -> MongoDB -> JSON
-> frontend service -> React state -> JSX
~~~

## 12. Copilot during an allowed test

1. Write function names and parameters yourself.
2. Predict the next line before accepting it.
3. Accept small suggestions, not an unexplained controller.
4. Verify every field against the real model and contract.
5. Reject suggestions that bypass existing authorization.
6. Reject code you cannot explain aloud.
7. Run checks after a substantial accepted suggestion.

Copilot is autocomplete, not the source of the API contract.

## 13. Forty-five-minute plan

### Minutes 0-5

Rewrite the requirement, fill the five implementation lines, and identify permissions/errors.

### Minutes 5-10

Find the nearest pattern, write the API contract, and list exact files.

### Minutes 10-22

Implement and test model/validation/controller/route.

### Minutes 22-35

Implement service, state, request, and four UI states.

### Minutes 35-42

Test success, invalid input, empty data, and unauthorized access when relevant.

### Minutes 42-45

Run checks, inspect the diff, and explain the flow aloud.

Complete one correct vertical flow instead of several unfinished alternatives.

## 14. Final checks

~~~powershell
node --check backend/models/ChangedModel.js
node --check backend/controllers/changedController.js
node --check backend/routes/changedRoutes.js
npm.cmd run build --prefix frontend
git diff --check
git status --short --branch
~~~

Confirm:

- Route and service use the same method/URL.
- Controller and React use the same response fields.
- Correct users can access it; incorrect users cannot.
- Invalid and empty data are handled.
- Repeated submission is disabled when required.
- Existing behavior still works.

## 15. Read next only when needed

1. `LIVE_TEST_PRIORITY_AND_ADVANCED_REFERENCE.md` for high-value code blocks.
2. `COPY_PASTE_PATTERNS.md` for reusable templates.
3. `MY_FEATURES_FILE_MAP.md` to locate assigned features.
4. The closest feature's full-stack guide.
5. `SYNTAX_AND_DATABASE_REFERENCE.md` for unclear syntax/MongoDB concepts.

Do not read every guide before coding. Understand the question, trace one flow, and open only the reference needed for the current layer.
