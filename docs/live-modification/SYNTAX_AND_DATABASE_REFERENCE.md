# JavaScript Syntax and MongoDB Reference

This reference is deliberately repetitive for handwritten practice and live modification tests.

## Most important before the details

Memorize these meanings first:

- `request.params` = route values.
- `request.query` = URL filters.
- `request.body` = submitted JSON.
- `request.user` = authenticated database user.
- `await` = wait for one Promise inside an async function.
- `return` = give a value back or stop the current function.
- `response.json(...)` = send JSON and finish the HTTP response.
- `Model.find(...)` = read an array from MongoDB.
- `Model.findOne(...)` = read one document or null.
- `findOneAndUpdate` with ownership in the filter = safe atomic modification.
- a React effect returns cleanup/undefined, never a Promise.
- loading, error, empty, and success are four separate UI states.

For the full emergency workflow, read
`LIVE_TEST_PRIORITY_AND_ADVANCED_REFERENCE.md` first.

## 1. Reading a dotted expression

~~~js
link.relationship = profile.personalInformation.familyRelationship;
~~~

Read the right side first:

1. `profile` stores an object or Mongoose document.
2. `.personalInformation` accesses a property belonging to `profile`.
3. `.familyRelationship` accesses a property belonging to `personalInformation`.
4. `link.relationship` accesses the destination property.
5. `=` assigns the right-side value to that destination.

A dot means "access a property or method belonging to the value on the left."

~~~js
const personalInformation = profile.personalInformation;
const familyRelationship = personalInformation.familyRelationship;
link.relationship = familyRelationship;
~~~

Dot access is not a database join. If `link` is a Mongoose document, the assignment changes memory first. `await link.save()` persists it.

## 2. Dot, bracket, optional, and method syntax

~~~js
const name = profile.personalInformation.fullName;

const sectionName = "medications";
const items = profile[sectionName];
~~~

Use dot notation for a known property. Brackets use the value stored in `sectionName`. `profile.sectionName` would literally search for a property named `sectionName`.

~~~js
const sugar = report.vitals?.bloodSugar ?? null;
const plainProfile = profile.toObject();
~~~

- `?.` continues only when the left value is not null or undefined.
- `??` supplies a fallback only for null or undefined; it keeps `0` and `false`.
- `toObject` is a method. Parentheses call it.

## 3. Variables, assignment, and comparison

~~~js
const profileId = request.params.profileId;
let generatedBy = "gemini";
generatedBy = "fallback";
~~~

Use `const` unless the variable itself must be reassigned. `=` assigns, `===` compares value and type, and `!==` means not equal.

## 4. Objects, arrays, destructuring, and spread

~~~js
const filter = {
  elderlyProfileId: profileId,
  status: "submitted",
};

const reportIds = [];
reportIds.push(report._id);
~~~

`push` adds to the end and changes the original array.

~~~js
const {
  profileId,
  section,
} = request.params;

const nextFilters = {
  ...currentFilters,
  status: "active",
};
~~~

Destructuring reads named properties. Spread copies enumerable properties; the later `status` replaces the copied status.

## 5. Conditions and truthy values

Falsy values are `false`, `0`, `""`, `null`, `undefined`, and `NaN`. Empty arrays and objects are truthy.

~~~js
if (!apiKey) {
  return null;
}

if (value === null || value === undefined) {
  return "Not recorded";
}
~~~

`!` reverses truthiness. Use explicit null checks when zero is a valid value.

## 6. Loops and array built-ins

~~~js
const submittedReports = [];

for (const report of reports) {
  if (report.status === "submitted") {
    submittedReports.push(report);
  }
}
~~~

- `map` creates a new array with one output per input.
- `find` returns the first match or undefined.
- `filter` returns all matches.
- `includes` returns true or false.
- `sort` changes the array being sorted.
- `slice` returns a selected copy and does not mutate the original.

~~~js
const reportIds = reports.map((report) => {
  return report._id;
});

const primary = contacts.find((contact) => {
  return contact.isPrimary === true;
});

const canEdit = ["owner", "editor"].includes(link.permission);
~~~
## 7. Functions, parameters, return, and callbacks

~~~js
function calculateTotal(price, quantity) {
  const total = price * quantity;
  return total;
}
~~~

- `calculateTotal` is the function name.
- `price` and `quantity` are parameters.
- `return` sends one result to the caller and stops the function.
- No explicit return means the result is `undefined`.
- A callback is a function passed to another function.

~~~js
setProfiles((currentProfiles) => {
  return [...currentProfiles, newProfile];
});
~~~

React calls this callback with the latest state.

## 8. Promise, async, await, try, catch, and finally

A Promise represents a future success value or failure error.

~~~js
async function loadProfile() {
  try {
    const data = await elderlyProfileService.getProfile(profileId);
    setProfile(data.profile);
  } catch (error) {
    setError(normalizeApiError(error).message);
  } finally {
    setLoading(false);
  }
}
~~~

- `async` makes the function return a Promise.
- `await` pauses this function until the Promise settles.
- `try` contains work that may fail.
- `catch` receives a thrown error or rejected Promise.
- `finally` runs after success or failure.
- `return response.data.data` resolves the Promise with that value.

## 9. Express request and response

~~~js
const profileId = request.params.profileId;
const status = request.query.status;
const fullName = request.body.personalInformation.fullName;
const familyUserId = request.user._id;
~~~

- `params` comes from the route path.
- `query` comes after `?` in the URL.
- `body` is JSON sent by the frontend.
- `user` is attached by authentication middleware.

~~~js
response.status(201).json({
  success: true,
  data: {
    profile,
  },
});
~~~

`status(201)` selects the status and returns the response object, allowing `.json(...)` to be chained. `json` serializes the object and ends the response.

## 10. React syntax and hooks

~~~jsx
function ProfileCard({ profile, onOpen }) {
  return (
    <button onClick={onOpen}>
      {profile.personalInformation.fullName}
    </button>
  );
}
~~~

JSX braces switch from markup to JavaScript. Pass an event handler as `onClick={onOpen}`. Writing `onClick={onOpen()}` calls it during rendering.

~~~js
const [profile, setProfile] = useState(null);
~~~

`useState` returns an array: the current value and its setter. Calling the setter schedules a rerender.

~~~js
useEffect(() => {
  async function load() {
    const data = await service.getRecord(recordId);
    setRecord(data.record);
  }

  load();
}, [recordId]);
~~~

`useEffect` runs after rendering. Each dependency is a value used by the effect that can change. Never make the effect callback itself `async`, because React expects no return or a cleanup function, not a Promise.

## 11. MongoDB and Mongoose vocabulary

- Document: one stored object.
- Collection: a group of documents.
- Schema: Mongoose structure, types, defaults, and validation.
- Model: functions for querying one collection.
- `_id`: unique MongoDB identifier.
- Reference: another document's `_id`, not a copied document.
- Query: conditions describing which documents should match.

## 12. Create operations

~~~js
const profile = await ElderlyProfile.create({
  ownerFamilyUserId: request.user._id,
  personalInformation: request.body.personalInformation,
});

const secondProfile = new ElderlyProfile(request.body);
await secondProfile.save();

const reports = await WellnessReport.insertMany(reportInputs);
~~~

`create` validates and inserts. `new Model` only creates an in-memory document until `save`. `insertMany` inserts an array.

## 13. Read operations

~~~js
const profile = await ElderlyProfile.findById(profileId);

const link = await ElderlyFamilyLink.findOne({
  elderlyProfileId: profileId,
  familyUserId,
  status: "active",
});

const reports = await WellnessReport.find({
  elderlyProfileId: profileId,
  status: "submitted",
});

const total = await WellnessReport.countDocuments({
  elderlyProfileId: profileId,
});
~~~

`findById` finds by `_id`. `findOne` returns one match or null. `find` returns an array. `countDocuments` returns a number without loading all documents.
## 14. Query modifiers

~~~js
const reports = await WellnessReport.find(filter)
  .select("visitDate vitals status")
  .sort({ visitDate: -1 })
  .skip(0)
  .limit(3)
  .lean();
~~~

- `select` limits returned fields.
- `sort` uses `-1` for descending and `1` for ascending.
- `skip` ignores earlier matching results.
- `limit` caps results.
- `lean` returns plain objects. Plain objects have no `.save()` or `.toObject()`.

## 15. Update operations

Load, change, save:

~~~js
const profile = await ElderlyProfile.findById(profileId);
profile.personalInformation.fullName = newName;
await profile.save();
~~~

Atomic update:

~~~js
const alert = await WellnessAlert.findOneAndUpdate(
  {
    _id: alertId,
    status: "active",
  },
  {
    $set: {
      status: "acknowledged",
    },
  },
  {
    new: true,
    runValidators: true,
  },
);
~~~

`$set` changes listed fields. `new: true` returns the updated document. `runValidators` applies schema validation. A filter containing the old status makes the transition atomic.

~~~js
await Notification.updateMany(
  {
    userId,
    readAt: null,
  },
  {
    $set: {
      readAt: new Date(),
    },
  },
);
~~~

`updateMany` updates every match.

## 16. Delete and archive operations

~~~js
await Example.deleteOne({ _id: recordId });
await Example.deleteMany({ testRunId });
~~~

Use physical deletion only when required. ProbashiCare often uses recoverable archiving:

~~~js
profile.status = "archived";
profile.archivedAt = new Date();
await profile.save();
~~~

## 17. MongoDB query operators

~~~js
const filter = {
  status: {
    $in: ["active", "acknowledged"],
  },
  generatedAt: {
    $gte: cooldownStart,
  },
  resolvedAt: {
    $ne: null,
  },
};
~~~

- `$in` and `$nin`: inside or outside an array of allowed values.
- `$ne`: not equal.
- `$gte` and `$gt`: greater than or equal, or greater than.
- `$lte` and `$lt`: less than or equal, or less than.
- `$exists`: field must exist or not exist.
- `$or`: at least one condition matches.
- `$and`: every condition matches.
- `$regex`: text pattern; escape user input before constructing it.
- `$setOnInsert`: fields applied only when an upsert creates a document.

## 18. Populate and references

~~~js
const alert = await WellnessAlert.findById(alertId).populate(
  "sourceReportIds",
  "visitDate submittedAt",
);
~~~

Before populate, `sourceReportIds` contains IDs. After populate, selected IDs become report objects in the returned result, limited to the chosen fields. The stored alert still contains IDs.

## 19. Aggregation basics

~~~js
const totals = await SubscriptionPayment.aggregate([
  {
    $match: {
      status: "completed",
    },
  },
  {
    $group: {
      _id: "$planCode",
      paymentCount: { $sum: 1 },
      totalAmount: { $sum: "$amount" },
    },
  },
  {
    $sort: {
      totalAmount: -1,
    },
  },
]);
~~~

- `$match` filters pipeline input.
- `$group` combines documents by a key.
- `$sum: 1` counts; `$sum: "$amount"` adds values.
- `$project` reshapes output.
- `$lookup` joins another collection.
- `$unwind` turns array elements into separate pipeline documents.

## 20. Indexes, uniqueness, and upsert

~~~js
wellnessInsightSchema.index({
  elderlyProfileId: 1,
  generatedAt: -1,
});
~~~

An index speeds matching/sorting but uses storage and adds write cost.

~~~js
elderlyFamilyLinkSchema.index(
  {
    elderlyProfileId: 1,
    familyUserId: 1,
  },
  {
    unique: true,
  },
);
~~~

A compound unique index prevents duplicate family/profile pairs. `upsert: true` means update a match or insert when none exists. A unique index is the final protection against concurrent duplicates.
## 21. Transactions

Use a transaction when several writes must all succeed or all roll back:

~~~js
const session = await mongoose.startSession();

try {
  await session.withTransaction(async () => {
    const profiles = await ElderlyProfile.create(
      [profileInput],
      { session },
    );

    await ElderlyFamilyLink.create(
      [{
        elderlyProfileId: profiles[0]._id,
        familyUserId,
        permission: "owner",
      }],
      { session },
    );
  });
} finally {
  await session.endSession();
}
~~~

A transaction requires MongoDB replica-set support. Passing the same `session` connects all included operations to the transaction.

## 22. Strings, numbers, dates, JSON, and URLs

~~~js
const cleanName = String(input || "").trim();
const page = Number(request.query.page || 1);
const validPage = Number.isInteger(page) && page > 0;
const createdAt = new Date();
const isoDate = createdAt.toISOString();
const jsonText = JSON.stringify({ page });
const parsedObject = JSON.parse(jsonText);
const safeModelName = encodeURIComponent(modelName);
~~~

- `String` converts a value to text.
- `trim` removes outside whitespace.
- `Number` converts to a number; invalid text becomes `NaN`.
- `Number.isInteger` tests for a whole number.
- `new Date()` creates a date/time value.
- `toISOString` creates UTC ISO text.
- `JSON.stringify` converts data to JSON text.
- `JSON.parse` converts JSON text to JavaScript data and may throw.
- `encodeURIComponent` safely encodes one URL segment or query value.

## 23. Frontend-to-database flow

~~~text
React event
  -> named handler
  -> frontend service (Axios Promise)
  -> Express route
  -> authentication and role middleware
  -> validation middleware
  -> controller
  -> authorization/access service
  -> Mongoose model query
  -> MongoDB collection
  -> controller JSON response
  -> Axios response.data
  -> React state setter
  -> rerendered JSX
~~~

Do not query MongoDB directly from React. The backend owns credentials, authorization, validation, and database operations.

## 24. Mongo shell/Compass operations

The actual collection name may be pluralized and lowercase by Mongoose.

~~~js
db.elderlyprofiles.find({
  status: "active",
})

db.elderlyprofiles.findOne({
  _id: ObjectId("REPLACE_WITH_ID"),
})

db.elderlyprofiles.countDocuments({
  status: "active",
})

db.elderlyprofiles.updateOne(
  { _id: ObjectId("REPLACE_WITH_ID") },
  { $set: { status: "archived" } },
)

db.wellnessreports.find({
  elderlyProfileId: ObjectId("REPLACE_WITH_ID"),
  status: "submitted",
}).sort({ visitDate: -1 }).limit(3)
~~~

Use a narrow filter before update or delete. Run the matching `find` first so you can see the exact target documents.

## 25. Authorization and concealed records

Authentication answers "who is signed in?" Role authorization answers "is this a family user?" Resource authorization answers "is this family user linked to this elderly profile and with what permission?"

ProbashiCare uses the same 404 for missing and inaccessible private profiles. This concealed 404 prevents outsiders from discovering which records exist.

## 26. Errors and status codes

- `200`: successful read/update.
- `201`: created.
- `400`: malformed action or token.
- `401`: not authenticated.
- `403`: authenticated but role/entitlement forbidden.
- `404`: missing or concealed private resource.
- `409`: state conflict or duplicate.
- `422`: understandable request with invalid field values.
- `500`: unexpected server failure.

Throw operational errors with `ApiError`; let `asyncHandler` pass rejected controller Promises to Express error middleware. On React, normalize the Axios error before displaying it.

## 27. Live-test checklist

1. Identify the collection that owns the needed data.
2. Search whether the endpoint already returns it.
3. Trace route, middleware, controller, service, and component.
4. Identify the IDs that relate collections.
5. Preserve role and owner/editor/viewer checks.
6. Decide whether the operation is read-only, one write, or several transactional writes.
7. Handle loading, empty, error, success, and submitting states.
8. Copy the closest existing pattern, changing one concept at a time.
9. Test one successful case and at least one denied/invalid case.
10. Run syntax checks, backend tests, frontend build, and `git diff --check`.