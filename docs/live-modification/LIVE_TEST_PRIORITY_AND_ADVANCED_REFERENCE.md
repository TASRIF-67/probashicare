# Live Modification Priority and Advanced Reference

Use this file during practice in two layers:

1. Read **Part A first**. It contains the highest-value steps and copy blocks.
2. Study Parts B-I to understand moderate and advanced code that already exists in ProbashiCare.

# Part A - Most important material

## A1. The full-stack path to memorize

Every ordinary MERN modification follows this path:

~~~text
React page or component
  -> frontend service
  -> HTTP method + URL + body/query/params
  -> Express route
  -> authentication and validation middleware
  -> controller
  -> service when business logic is reusable
  -> Mongoose model/query
  -> MongoDB
  -> JSON response
  -> frontend state
  -> rendered loading/error/empty/success UI
~~~

If a question says "show another value", first find the existing path and change the smallest layer that owns the missing value.

## A2. The four request locations

~~~js
const notificationId = request.params.notificationId;
const page = request.query.page;
const title = request.body.title;
const currentUserId = request.user._id;
~~~

- `params`: values inside the route, such as `/:notificationId`.
- `query`: optional URL filters after `?`.
- `body`: JSON sent by POST, PUT, or PATCH.
- `user`: trusted user attached by authentication middleware.

Never accept an owner ID from the body when `request.user._id` is the real owner.

## A3. The safest ownership query

~~~js
const record = await Example.findOne({
  _id: request.params.recordId,
  ownerUserId: request.user._id,
});

if (!record) {
  throw new ApiError(404, "Record not found.");
}
~~~

Putting both IDs in the same query prevents another user from reading the record. Returning the same 404 for missing and unauthorized records is called a concealed 404.

## A4. The safest atomic update

~~~js
const updatedRecord = await Example.findOneAndUpdate(
  {
    _id: request.params.recordId,
    ownerUserId: request.user._id,
    status: "pending",
  },
  {
    $set: {
      status: "completed",
      completedAt: new Date(),
    },
  },
  {
    new: true,
    runValidators: true,
  },
);

if (!updatedRecord) {
  throw new ApiError(404, "Pending record not found.");
}
~~~

The status condition and update happen in one database operation. Two concurrent requests cannot both change the same pending record successfully.

## A5. Controller response block

~~~js
response.status(200).json({
  success: true,
  data: {
    record: updatedRecord,
  },
});
~~~

- `status(200)` selects the HTTP status.
- `json` converts the object to JSON and ends the response.
- `return` is usually unnecessary after the final response, but it is useful when an early response must stop the function.

## A6. React data-loading block

~~~jsx
useEffect(() => {
  let active = true;

  async function loadRecords() {
    setLoading(true);
    setError("");

    try {
      const data = await exampleService.list();

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

  return function stopLateStateUpdates() {
    active = false;
  };
}, []);
~~~

Never write `useEffect(async () => {})`. An effect may return only a cleanup function or undefined, not a Promise.

## A7. Frontend service block

~~~js
async function listRecords(params = {}) {
  const response = await api.get("/examples", {
    params,
  });

  return response.data.data;
}

async function createRecord(input) {
  const response = await api.post(
    "/examples",
    input,
  );

  return response.data.data.record;
}
~~~

The service owns HTTP details. The component owns visible state and user interaction.

## A8. Related-collection lookup

If the question says "show the caregiver's name from the User collection":

~~~js
const bookings = await Booking.find({
  familyMemberId: request.user._id,
})
  .populate("caregiverId", "name")
  .lean();
~~~

`populate` replaces the referenced ObjectId in the result with selected fields from the referenced model. The schema field must have a matching `ref`.

Manual alternative:

~~~js
const booking = await Booking.findOne({
  _id: request.params.bookingId,
});

const caregiver = await User.findById(
  booking.caregiverId,
).select("name");

response.json({
  success: true,
  data: {
    booking,
    caregiverName: caregiver?.name || "Unknown",
  },
});
~~~

## A9. Fast exam decision table

| Requirement wording | First code to find |
| --- | --- |
| Show/list | GET route, find query, frontend effect |
| Add/create | POST route, validation, create |
| Edit/update | PATCH/PUT route, findOneAndUpdate |
| Delete | deleteOne or soft-status update |
| Another collection | populate, second query, or lookup |
| Current user only | request.user._id in every query |
| Filter | request.query plus a filter object |
| Count | countDocuments or aggregation group |
| Paginate | page, limit, skip, countDocuments |
| Avoid duplicates | unique index plus upsert |
| Several writes together | transaction/session |
| External API may fail | timeout, validate, fallback |
| Shared frontend data | Context provider/custom hook |

## A10. Final five-minute checklist

1. Is the HTTP method and URL identical in route and frontend service?
2. Does the controller use `request.user._id` for ownership?
3. Are params, body, query, and ObjectIds validated?
4. Does every async request have try/catch at the correct layer?
5. Does the response shape match what the frontend reads?
6. Does the page show loading, error, empty, and success?
7. Does an effect return cleanup or undefined, never a Promise?
8. Can concurrent requests create duplicates or invalid status changes?
9. Did you run `node --check`, backend tests, frontend build, and `git diff --check`?
10. Can you explain the flow aloud from click to MongoDB and back?

# Part B - Moderate JavaScript

## B1. Values, references, and copying

Primitive values such as strings, numbers, and booleans are copied by value.

~~~js
let firstCount = 2;
let secondCount = firstCount;
secondCount = 5;
~~~

Changing `secondCount` does not change `firstCount`.

Objects and arrays are reference values:

~~~js
const original = {
  status: "pending",
};
const sameObject = original;
sameObject.status = "complete";
~~~

Both variables point to the same object.

Create a shallow copy:

~~~js
const copiedObject = {
  ...original,
  status: "cancelled",
};
~~~

Spread copies the first level only. Nested objects still share references unless copied too.

## B2. Destructuring, rest, and spread

~~~js
const {
  page = 1,
  limit = 20,
} = request.query;
~~~

Destructuring reads properties into variables. Defaults apply only when a value is undefined.

~~~js
function allowRoles(...allowedRoles) {
  return function checkRole(request, response, next) {
    // allowedRoles is an array.
  };
}
~~~

Rest gathers several arguments into one array. Spread copies or expands existing values.

## B3. Optional chaining and nullish coalescing

~~~js
const bloodSugar =
  report.vitals?.bloodSugar ?? null;
~~~

- `?.` stops and returns undefined when the left value is null/undefined.
- `??` uses the fallback only for null/undefined.
- `||` also replaces `0`, `false`, and empty strings.

For a valid zero measurement, prefer `??` rather than `||`.

## B4. Array methods and their return values

~~~js
const names = users.map((user) => user.name);
const active = users.filter((user) => user.isActive);
const owner = links.find((link) => link.permission === "owner");
const hasAdmin = users.some((user) => user.role === "admin");
const allVerified = users.every((user) => user.isVerified);
~~~

- `map`: new array with one output per input.
- `filter`: new array containing matching inputs.
- `find`: first matching item or undefined.
- `some`: boolean; at least one match.
- `every`: boolean; all items match.
- None of these automatically changes the original array.

Use `for...of` when several statements or early `continue`/`break` make the logic clearer.

~~~js
const selectedIds = [];

for (const item of items) {
  if (!item.selected) {
    continue;
  }

  selectedIds.push(item._id);
}
~~~

## B5. Closure

A closure is a function that remembers variables from where it was created.

~~~js
function allowRoles(...allowedRoles) {
  return function checkRole(request, response, next) {
    if (!allowedRoles.includes(request.user.role)) {
      throw new ApiError(403, "Forbidden.");
    }

    next();
  };
}
~~~

`checkRole` still knows `allowedRoles` after `allowRoles` has returned. Express middleware factories and React callbacks use closures often.

## B6. Promise states and async/await

A Promise is pending, then becomes fulfilled or rejected once.

~~~js
async function loadUser(userId) {
  try {
    const user = await User.findById(userId);
    return user;
  } catch (error) {
    throw error;
  } finally {
    // Cleanup runs after success and failure.
  }
}
~~~

An `async` function always returns a Promise. Returning `user` fulfills it with that value. Throwing rejects it.

## B7. Promise.all and Promise.allSettled

Use `Promise.all` for independent operations that must all succeed:

~~~js
const [
  records,
  unreadCount,
  total,
] = await Promise.all([
  Example.find(filter).lean(),
  Example.countDocuments({
    ...filter,
    isRead: false,
  }),
  Example.countDocuments(filter),
]);
~~~

It preserves result order but rejects immediately when one input rejects.

Use `Promise.allSettled` when every result must be inspected even if one fails:

~~~js
const results = await Promise.allSettled([
  sendEmail(firstUser),
  sendEmail(secondUser),
]);

for (const result of results) {
  if (result.status === "rejected") {
    console.error(result.reason);
  }
}
~~~

## B8. Event loop practical rule

Synchronous code runs first. Promise callbacks run before timer callbacks after the current stack finishes. For the test, remember the practical result: `await` pauses only the current async function; it does not freeze the Node server or browser.

## B9. Date safety

~~~js
const date = new Date(request.body.visitDate);

if (Number.isNaN(date.getTime())) {
  throw new ApiError(422, "Visit date is invalid.");
}
~~~

Compare timestamps:

~~~js
if (endDate.getTime() < startDate.getTime()) {
  throw new ApiError(
    422,
    "End date must not be before start date.",
  );
}
~~~

Store UTC Date values in MongoDB. Format for the user in the frontend.

# Part C - React from moderate to advanced

## C1. Render and state

A component function runs again when its state, props, or consumed context changes. Do not perform API requests directly during render.

~~~jsx
const [count, setCount] = useState(0);

function increase() {
  setCount((currentCount) => {
    return currentCount + 1;
  });
}
~~~

Functional updates use the latest state and avoid stale values.

## C2. Controlled fields

~~~jsx
const [form, setForm] = useState({
  title: "",
});

function changeTitle(event) {
  const nextTitle = event.target.value;

  setForm((currentForm) => {
    return {
      ...currentForm,
      title: nextTitle,
    };
  });
}

<input
  value={form.title}
  onChange={changeTitle}
/>
~~~

The state is the source of truth.

## C3. Effect dependency rules

Dependencies are values read by the effect that may change between renders.

~~~jsx
const loadRecords = useCallback(async () => {
  const data = await service.list({
    page,
  });
  setRecords(data.records);
}, [page]);

useEffect(() => {
  loadRecords();
}, [loadRecords]);
~~~

`useCallback` keeps a function identity stable until its dependencies change. Use it when a function is itself an effect dependency or passed to memoized children; do not add it everywhere.

## C4. Effect cleanup and AbortController

A boolean prevents late state changes. AbortController also asks fetch/Axios to cancel supported requests.

~~~jsx
useEffect(() => {
  const controller = new AbortController();

  async function load() {
    try {
      const response = await api.get("/examples", {
        signal: controller.signal,
      });
      setRecords(response.data.data.records);
    } catch (error) {
      if (error.name !== "CanceledError") {
        setError("Could not load.");
      }
    }
  }

  load();

  return function cancelRequest() {
    controller.abort();
  };
}, []);
~~~

## C5. Context and custom hooks

~~~jsx
const ExampleContext = createContext(null);

export function ExampleProvider({ children }) {
  const [records, setRecords] = useState([]);

  const value = useMemo(() => {
    return {
      records,
      setRecords,
    };
  }, [records]);

  return (
    <ExampleContext.Provider value={value}>
      {children}
    </ExampleContext.Provider>
  );
}

export function useExamples() {
  const value = useContext(ExampleContext);

  if (!value) {
    throw new Error(
      "useExamples must be inside ExampleProvider.",
    );
  }

  return value;
}
~~~

Context avoids passing shared data through every intermediate component. It is not a database and disappears on refresh unless reloaded.

## C6. useMemo, useCallback, and useRef

- `useMemo` remembers a calculated value/object.
- `useCallback` remembers a function identity.
- `useRef` remembers a mutable value or DOM node without rendering when changed.

Do not use memoization as a replacement for correct logic.

## C7. Stale closure

This can use an old count:

~~~jsx
setTimeout(() => {
  setCount(count + 1);
}, 1000);
~~~

Safer:

~~~jsx
setTimeout(() => {
  setCount((currentCount) => {
    return currentCount + 1;
  });
}, 1000);
~~~

## C8. Keys

~~~jsx
{records.map((record) => (
  <RecordCard
    key={record._id}
    record={record}
  />
))}
~~~

Use a stable database ID, not the array index, when rows can be added, removed, or reordered.

# Part D - Express and API design

## D1. Middleware order

~~~js
router.patch(
  "/:recordId",
  asyncHandler(requireAuth),
  allowRoles("family"),
  validateObjectId("recordId"),
  validatePayload,
  asyncHandler(updateRecord),
);
~~~

Order:

1. authenticate,
2. check role,
3. validate route/body,
4. execute controller.

A middleware calls `next()` to continue or passes/throws an error to stop normal processing.

## D2. Route order

Declare fixed routes before dynamic IDs:

~~~js
router.patch("/read-all", markAll);
router.patch("/:notificationId/read", markOne);
~~~

Otherwise Express may interpret "read-all" as an ID.

## D3. HTTP statuses

- 200: successful read/update.
- 201: new record created.
- 204: success with no response body.
- 400: malformed request.
- 401: not authenticated.
- 403: authenticated but role/action forbidden.
- 404: missing or concealed unauthorized resource.
- 409: duplicate or invalid state conflict.
- 422: semantically invalid fields.
- 500: unexpected server error.
- 502/503: external provider unavailable.

## D4. API contract

Write the contract before code:

~~~text
GET /api/examples?page=1&status=active
Auth: family
Success 200:
{
  "success": true,
  "data": {
    "records": [],
    "pagination": {
      "page": 1,
      "limit": 3,
      "total": 0,
      "pages": 0
    }
  }
}
~~~

The frontend must read this exact shape.

## D5. Idempotency

An operation is idempotent when repeating it has the same final effect.

- Setting `isRead: true` is idempotent.
- Creating a notification needs a deduplication key and unique index.
- Payment webhooks need provider event IDs.
- Adding `amount += 10` is not idempotent.

# Part E - MongoDB and Mongoose

## E1. Embed or reference

Embed when data belongs only to one parent and is usually loaded together:

~~~js
medications: [
  {
    name: String,
    dosage: String,
  },
]
~~~

Reference when records have separate lifecycles, permissions, or many relationships:

~~~js
caregiverId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
}
~~~

## E2. Core query methods

~~~js
await Model.create(input);
await Model.find(filter);
await Model.findOne(filter);
await Model.findById(id);
await Model.findOneAndUpdate(filter, update, options);
await Model.updateMany(filter, update);
await Model.deleteOne(filter);
await Model.deleteMany(filter);
await Model.countDocuments(filter);
await Model.exists(filter);
~~~

`find` returns an array. `findOne` and `findById` return one document or null.

## E3. Projection/select and lean

~~~js
const users = await User.find({
  role: "caregiver",
})
  .select("name role")
  .lean();
~~~

Projection reduces transferred fields. Never return private email/password fields merely because the UI ignores them. `lean` returns plain objects faster for read-only responses.

## E4. Common update operators

~~~js
{
  $set: {
    status: "read",
  },
  $unset: {
    temporaryValue: "",
  },
  $inc: {
    retryCount: 1,
  },
  $push: {
    notes: newNote,
  },
  $addToSet: {
    tags: "important",
  },
  $pull: {
    tags: "obsolete",
  },
}
~~~

- `$set` replaces fields.
- `$unset` removes fields.
- `$inc` atomically adds/subtracts.
- `$push` appends even duplicates.
- `$addToSet` appends only when absent.
- `$pull` removes matching array values.

## E5. Query operators

~~~js
const filter = {
  status: {
    $in: ["active", "accepted"],
  },
  createdAt: {
    $gte: startDate,
    $lte: endDate,
  },
  caregiverId: {
    $ne: null,
  },
};
~~~

Other useful operators: `$nin`, `$gt`, `$lt`, `$exists`, `$or`, `$and`, and `$regex`.

Never copy an untrusted body object directly into a Mongo filter; allowlist expected values.

## E6. Offset pagination

~~~js
const page = Math.max(
  1,
  Number.parseInt(request.query.page, 10) || 1,
);
const limit = 3;
const skip = (page - 1) * limit;

const [records, total] = await Promise.all([
  Example.find(filter)
    .sort({
      createdAt: -1,
    })
    .skip(skip)
    .limit(limit)
    .lean(),
  Example.countDocuments(filter),
]);

const pages = Math.ceil(total / limit);
~~~

Offset pagination is simple. Cursor pagination scales better for very large changing lists but is less likely in this test.

## E7. populate versus aggregation lookup

Use `populate` for straightforward model references:

~~~js
const bookings = await Booking.find(filter)
  .populate("caregiverId", "name")
  .lean();
~~~

Use `$lookup` when grouping/filtering across collections:

~~~js
const results = await Booking.aggregate([
  {
    $match: {
      familyMemberId: request.user._id,
    },
  },
  {
    $lookup: {
      from: "users",
      localField: "caregiverId",
      foreignField: "_id",
      as: "caregiver",
    },
  },
  {
    $unwind: {
      path: "$caregiver",
      preserveNullAndEmptyArrays: true,
    },
  },
  {
    $project: {
      status: 1,
      caregiverName: "$caregiver.name",
    },
  },
]);
~~~

Aggregation stages run in order. Each stage transforms the documents passed to the next stage.

## E8. Grouping and dashboard totals

~~~js
const totals = await Payment.aggregate([
  {
    $match: {
      status: "completed",
    },
  },
  {
    $group: {
      _id: "$planCode",
      paymentCount: {
        $sum: 1,
      },
      revenue: {
        $sum: "$amount",
      },
    },
  },
  {
    $sort: {
      revenue: -1,
    },
  },
]);
~~~

`_id` in `$group` is the grouping key. Set it to null for one overall total.

## E9. Facet for list plus count

~~~js
const result = await Example.aggregate([
  {
    $match: filter,
  },
  {
    $facet: {
      records: [
        {
          $sort: {
            createdAt: -1,
          },
        },
        {
          $skip: skip,
        },
        {
          $limit: limit,
        },
      ],
      totals: [
        {
          $count: "value",
        },
      ],
    },
  },
]);
~~~

`$facet` runs several sub-pipelines on the same matched input.

## E10. Index order

~~~js
schema.index({
  ownerUserId: 1,
  status: 1,
  createdAt: -1,
});
~~~

This supports queries starting with owner, then optional status, then date sorting. Compound index field order should follow common equality filters before range/sort fields.

Unique indexes enforce data integrity under concurrency. Application checks alone can race.

## E11. Upsert and duplicate protection

~~~js
const record = await Example.findOneAndUpdate(
  {
    deduplicationKey,
  },
  {
    $setOnInsert: values,
  },
  {
    upsert: true,
    new: true,
    runValidators: true,
    setDefaultsOnInsert: true,
  },
);
~~~

Pair this with a unique index. `$setOnInsert` keeps repeated requests from changing the original record.

## E12. Transaction

~~~js
const session = await mongoose.startSession();

try {
  let result;

  await session.withTransaction(async () => {
    const created = await FirstModel.create(
      [firstInput],
      {
        session,
      },
    );

    await SecondModel.create(
      [
        {
          firstId: created[0]._id,
        },
      ],
      {
        session,
      },
    );

    result = created[0];
  });

  return result;
} finally {
  await session.endSession();
}
~~~

Use a transaction when several writes represent one business action. Every query/write inside it must receive the same session.

## E13. bulkWrite

~~~js
await Example.bulkWrite([
  {
    updateOne: {
      filter: {
        _id: firstId,
      },
      update: {
        $set: {
          status: "active",
        },
      },
    },
  },
  {
    updateOne: {
      filter: {
        _id: secondId,
      },
      update: {
        $set: {
          status: "active",
        },
      },
    },
  },
]);
~~~

Use this for many known database operations. It is not automatically a transaction.

# Part F - Security and reliability

## F1. Role authorization versus resource authorization

Role check:

~~~js
allowRoles("family")
~~~

Resource check:

~~~js
{
  _id: recordId,
  familyUserId: request.user._id,
}
~~~

Most sensitive endpoints need both.

## F2. Mass assignment

Unsafe:

~~~js
await User.findByIdAndUpdate(
  request.user._id,
  request.body,
);
~~~

A client could try to change role or verification state.

Safe allowlist:

~~~js
const update = {
  name: request.body.name,
};

await User.findByIdAndUpdate(
  request.user._id,
  {
    $set: update,
  },
  {
    runValidators: true,
  },
);
~~~

## F3. External API fallback

~~~js
let summary = null;

try {
  summary = await provider.generate(safePayload);
} catch (error) {
  console.error("Provider unavailable", error);
}

if (!summary) {
  summary = buildFallback(safePayload);
}
~~~

Sanitize before sending, set a timeout, validate the provider response, and save which provider generated the result.

## F4. Concurrency questions to ask

1. Can two requests create the same logical record?
2. Can two users update the same status?
3. Can an old client overwrite a newer value?
4. Is there a unique index?
5. Can the condition be included in one atomic update?
6. Do several writes need one transaction?

# Part G - Testing

## G1. Unit test

A unit test replaces the database method and verifies controller logic. Always restore monkey-patched methods in `finally`.

~~~js
const originalFindOne = Model.findOne;
let receivedFilter;

Model.findOne = async (filter) => {
  receivedFilter = filter;
  return fakeRecord;
};

try {
  await controller(request, response);
} finally {
  Model.findOne = originalFindOne;
}

assert.deepEqual(receivedFilter, {
  ownerUserId: request.user._id,
});
~~~

## G2. Authenticated integration smoke test

An integration smoke test should:

1. create uniquely marked temporary users,
2. log in through the real API,
3. call the real protected endpoint,
4. verify owner isolation,
5. verify database results,
6. delete only records with the marker,
7. close the server and database in `finally`.

Feature 3 implements this in `backend/scripts/smokeNotifications.js`.

# Part H - Deployment and Git

## H1. Deployment flow

~~~text
Vercel frontend
  -> VITE_API_URL
  -> Render backend
  -> CLIENT_URL for CORS
  -> MongoDB Atlas
  -> external provider environment variables
~~~

A local URL in production environment variables causes requests to the user's own machine, not the deployed backend.

## H2. Cookie/CORS requirements

For cross-origin cookie authentication:

- backend CORS must allow the exact frontend origin,
- `credentials: true` must be set on backend CORS,
- frontend Axios must send credentials,
- production cookies generally need `Secure` and suitable `SameSite`.

## H3. Safe Git commands

~~~powershell
git status --short --branch
git diff -- path/to/file
git diff --check
git add path/to/only-intended-file
git diff --cached
git commit -m "clear message"
~~~

Do not use reset, restore, checkout-over-file, or clean when classmates have uncommitted work you must preserve.

# Part I - What to copy during a live test

Start with these existing project examples:

1. Ownership CRUD: `elderlyProfileController.js`.
2. External API with fallback: `wellnessInsightService.js` and `geminiWellnessService.js`.
3. Idempotent upsert: `notificationService.js`.
4. Pagination plus counts: `notificationController.js`.
5. Shared React state and polling: `NotificationContext.jsx`.
6. Transaction: elderly profile creation or payment completion.
7. Aggregation analytics: admin subscription analytics.
8. Authenticated Mongo smoke: `smokeNotifications.js`.
9. Form page: `ProfileForm.jsx`.
10. API wrapper: any file in `frontend/src/services`.

The larger reusable blocks remain in `COPY_PASTE_PATTERNS.md`. Search that file by requirement word before writing from memory.