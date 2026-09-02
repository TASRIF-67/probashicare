# MongoDB and Mongoose Query Reference

Open this file when you recognize the required database action but cannot remember the method, filter, operator, options, or return value. Examples use Mongoose models, which is how ProbashiCare accesses MongoDB.

## Start here: choose the operation

| Requirement | Common Mongoose operation |
| --- | --- |
| Create one document | `Model.create(data)` |
| Read a list | `Model.find(filter)` |
| Read one matching document | `Model.findOne(filter)` |
| Read one document by `_id` | `Model.findById(id)` |
| Update one and receive the updated document | `Model.findOneAndUpdate(filter, update, options)` |
| Update one and receive counts | `Model.updateOne(filter, update)` |
| Update many | `Model.updateMany(filter, update)` |
| Delete one and receive it | `Model.findOneAndDelete(filter)` |
| Count matching documents | `Model.countDocuments(filter)` |
| Join referenced documents | `.populate(path, fields)` |
| Calculate grouped analytics | `Model.aggregate(stages)` |
| Create when missing, otherwise update | `findOneAndUpdate(..., { upsert: true })` |

## Read every query in three parts

~~~javascript
const updatedAlert = await WellnessAlert.findOneAndUpdate(
  // 1. FILTER: which document is allowed to match?
  {
    _id: alertId,
    familyUserId: request.user._id,
    status: 'active',
  },

  // 2. UPDATE: what database change should happen?
  {
    $set: {
      status: 'resolved',
      resolvedAt: new Date(),
    },
  },

  // 3. OPTIONS: how should Mongoose execute/return it?
  {
    new: true,
    runValidators: true,
  },
);
~~~

Read it aloud: find one alert with this ID, owned by this family, that is still active; set it to resolved; return the updated validated document.

`await` pauses this async function until the database operation settles. The variable receives a Mongoose document or `null` when no filter matched.

## Filter safety rule

Put identity, ownership, and allowed current state into the filter whenever possible:

~~~javascript
const filter = {
  _id: request.params.recordId,
  familyUserId: request.user._id,
  status: 'pending',
};
~~~

This performs permission and state checking atomically. Never update a private record using only an ID supplied by the client.

## Create operations

~~~javascript
const profile = await ElderlyProfile.create({
  familyUserId: request.user._id,
  personalInformation: request.body.personalInformation,
});
~~~

`create` validates, inserts, and returns the created Mongoose document. An alternative is useful when changing fields before saving:

~~~javascript
const profile = new ElderlyProfile(request.body);
profile.familyUserId = request.user._id;
await profile.save();
~~~

`save()` returns a Promise and runs schema validation and save middleware.

## Read operations and their return values

~~~javascript
const records = await Example.find(filter);       // Always an array; [] when none.
const record = await Example.findOne(filter);     // One document or null.
const byId = await Example.findById(recordId);     // One document or null.
const total = await Example.countDocuments(filter); // A number.
const exists = await Example.exists(filter);      // Small result object or null.
~~~

`findById(id)` is shorthand for `findOne({ _id: id })`, but an ownership check is clearer with `findOne`:

~~~javascript
const record = await Example.findOne({
  _id: recordId,
  familyUserId: request.user._id,
});
~~~

Use `.lean()` for read-only results when document methods, virtual behavior, and `save()` are unnecessary:

~~~javascript
const records = await Example.find(filter).lean();
~~~

Lean results are plain JavaScript objects, not Mongoose documents.

## Update methods: know the difference

~~~javascript
const result = await Example.updateOne(filter, update);
~~~

`updateOne` returns metadata such as `matchedCount` and `modifiedCount`, not the updated document.

~~~javascript
const record = await Example.findOneAndUpdate(
  filter,
  update,
  {
    new: true,
    runValidators: true,
  },
);
~~~

`findOneAndUpdate` returns the matched document or `null`. Important options:

| Option | Meaning |
| --- | --- |
| `new: true` | Return the document after the update; otherwise Mongoose returns the old version. |
| `runValidators: true` | Apply schema validators to supported updated fields. |
| `upsert: true` | Insert a document when no filter matches. |
| `session` | Make the operation part of a transaction. |

Document-editing style:

~~~javascript
const record = await Example.findOne(filter);

if (!record) {
  throw new ApiError(404, 'Record not found.');
}

record.title = request.body.title;
await record.save();
~~~

Use find-change-save when document middleware or complex in-memory logic is required. Use `findOneAndUpdate` for a concise atomic state transition.

`updateMany` returns counts and changes every matching document. Use a narrow filter and never run it accidentally with `{}`.

## Update operators

| Operator | Purpose | Example meaning |
| --- | --- | --- |
| `$set` | Set or replace selected fields | Set status and timestamp |
| `$unset` | Remove fields | Remove a temporary token |
| `$inc` | Add/subtract a number | Increase unread count by 1 |
| `$push` | Append to an array | Add history, allowing duplicates |
| `$addToSet` | Append only if absent | Add a unique member ID |
| `$pull` | Remove matching array entries | Remove one caregiver ID |
| `$setOnInsert` | Set fields only when upsert inserts | Initial creation values |
| `$currentDate` | Set a field to database current time | Update `updatedAt`-like timestamp |

~~~javascript
await Example.findOneAndUpdate(
  { _id: recordId, familyUserId: request.user._id },
  {
    $set: { status: 'active' },
    $inc: { revision: 1 },
    $addToSet: { viewerIds: request.user._id },
    $push: {
      history: {
        action: 'activated',
        at: new Date(),
      },
    },
    $unset: { draftReason: 1 },
  },
  { new: true, runValidators: true },
);
~~~

`$set` changes only listed paths; it does not replace the entire document. Dot notation updates a nested field without replacing its parent object:

~~~javascript
{ $set: { 'personalInformation.phone': newPhone } }
~~~

Avoid setting `personalInformation` to a partial object unless replacing all of it is intentional.

### Updating embedded array elements

~~~javascript
await Example.updateOne(
  {
    _id: recordId,
    familyUserId,
    'tasks._id': taskId,
  },
  {
    $set: {
      'tasks.$.completed': true,
      'tasks.$.completedAt': new Date(),
    },
  },
);
~~~

The positional `$` means the first array element matched by the filter. `$[]` means all elements. `$[task]` means elements selected by `arrayFilters`:

~~~javascript
await Example.updateOne(
  { _id: recordId, familyUserId },
  { $set: { 'tasks.$[task].priority': 'high' } },
  { arrayFilters: [{ 'task.completed': false }] },
);
~~~

Use these only after confirming whether the schema stores embedded objects or referenced documents.

### ID convenience methods

`findByIdAndUpdate(id, update, options)` and `findByIdAndDelete(id)` are convenient, but they only filter by `_id`. Prefer `findOneAndUpdate` or `findOneAndDelete` when ownership or status must be part of the same filter.

## Filter and comparison operators

| Operator | Meaning |
| --- | --- |
| `$eq`, `$ne` | Equal, not equal |
| `$gt`, `$gte` | Greater than, greater than or equal |
| `$lt`, `$lte` | Less than, less than or equal |
| `$in`, `$nin` | Value appears/does not appear in a supplied list |
| `$exists` | Field exists or does not exist |
| `$or`, `$and`, `$nor` | Combine conditions |
| `$regex` | Pattern/text matching |
| `$elemMatch` | One array element must satisfy several conditions |

~~~javascript
const filter = {
  familyUserId: request.user._id,
  status: { $in: ['active', 'completed'] },
  createdAt: {
    $gte: startDate,
    $lt: endDate,
  },
  deletedAt: { $exists: false },
  $or: [
    { title: { $regex: escapedSearch, $options: 'i' } },
    { notes: { $regex: escapedSearch, $options: 'i' } },
  ],
};
~~~

Do not place raw user text into a regular expression without escaping it. Prefer exact filters when search is not required.

Array examples:

~~~javascript
// Scalar exists in an array field.
{ caregiverIds: caregiverId }

// One embedded array element satisfies both rules.
{
  medications: {
    $elemMatch: {
      active: true,
      supplyDays: { $lte: 7 },
    },
  },
}
~~~

## Query chaining, sorting, and pagination

~~~javascript
const page = Math.max(Number.parseInt(request.query.page, 10) || 1, 1);
const limit = Math.min(Number.parseInt(request.query.limit, 10) || 3, 50);
const skip = (page - 1) * limit;

const [records, total] = await Promise.all([
  Example.find(filter)
    .select('title status createdAt caregiverId')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean(),
  Example.countDocuments(filter),
]);
~~~

Read the chain left to right:

- `find(filter)` chooses matching documents.
- `select(...)` includes only needed fields.
- `sort({ createdAt: -1 })` orders newest first; `1` means ascending.
- `skip(...)` ignores earlier pages.
- `limit(...)` caps the returned page size.
- `lean()` returns plain objects.

~~~javascript
const totalPages = Math.max(Math.ceil(total / limit), 1);
~~~

Use the identical filter for the list and count queries.

## `populate`: resolve referenced documents

If `caregiverId` stores an ObjectId reference:

~~~javascript
const booking = await Booking.findOne(filter)
  .populate('caregiverId', 'name email profilePhoto')
  .lean();
~~~

Populate replaces the referenced ID with selected caregiver fields. It is convenient but is not the same as embedding data. Missing/deleted referenced documents may populate as `null`.

Use aggregation `$lookup` when joining and then filtering/grouping across collections is required.

## Aggregation pipeline

Aggregation passes documents through ordered stages. Stage order changes the result.

~~~javascript
const totals = await Payment.aggregate([
  { $match: { status: 'completed' } },
  {
    $group: {
      _id: '$planCode',
      paymentCount: { $sum: 1 },
      revenue: { $sum: '$amount' },
      averagePayment: { $avg: '$amount' },
    },
  },
  { $sort: { revenue: -1 } },
]);
~~~

Common stages:

| Stage | Purpose |
| --- | --- |
| `$match` | Filter documents, preferably early |
| `$project` | Include, exclude, or calculate fields |
| `$group` | Group and calculate `$sum`, `$avg`, `$min`, `$max` |
| `$sort`, `$skip`, `$limit` | Order and paginate |
| `$unwind` | Turn array elements into separate pipeline documents |
| `$lookup` | Join another collection |
| `$count` | Return a count result |

Aggregation returns an array of plain result objects, even when only one grouped result is expected.

## Upsert and duplicate prevention

~~~javascript
const notification = await Notification.findOneAndUpdate(
  { recipient: userId, dedupeKey },
  {
    $set: { message, link },
    $setOnInsert: { createdAt: new Date() },
  },
  { new: true, upsert: true, runValidators: true },
);
~~~

`upsert` means update a match or insert when none exists. Pair deduplication upserts with a unique index; application checks alone can race.

## Indexes

~~~javascript
exampleSchema.index(
  { familyUserId: 1, elderlyProfileId: 1 },
  { unique: true },
);

exampleSchema.index({ familyUserId: 1, createdAt: -1 });
~~~

Indexes speed common filters/sorts and can enforce uniqueness, but they consume storage and add write cost. A schema declaration does not always update existing database indexes automatically; use the repository's approved index synchronization process.

## Delete, archive, and return values

~~~javascript
const deleted = await Example.findOneAndDelete(filter); // Document or null.
const result = await Example.deleteOne(filter);         // Counts, not document.
~~~

For business/history data, prefer soft deletion or status changes:

~~~javascript
const archived = await Example.findOneAndUpdate(
  filter,
  { $set: { status: 'archived', archivedAt: new Date() } },
  { new: true },
);
~~~

## Transactions

Use a transaction when several related writes must all succeed or all roll back.

~~~javascript
const session = await mongoose.startSession();

try {
  await session.withTransaction(async () => {
    await Payment.create([paymentData], { session });
    await Subscription.updateOne(filter, update, { session });
  });
} finally {
  await session.endSession();
}
~~~

Every operation participating in the transaction must receive the same `session`. Transactions require a MongoDB replica set, including Atlas.

## ObjectId and date checks

~~~javascript
if (!mongoose.isValidObjectId(request.params.recordId)) {
  throw new ApiError(404, 'Record not found.');
}

const startDate = new Date(request.query.startDate);

if (Number.isNaN(startDate.getTime())) {
  throw new ApiError(422, 'Invalid start date.');
}
~~~

Validate external IDs before querying. Use half-open date ranges (`$gte` start and `$lt` next boundary) to avoid missing records with times.

## Bulk operations

Use `bulkWrite` for many known writes in one database round trip:

~~~javascript
await Example.bulkWrite(
  records.map((record) => ({
    updateOne: {
      filter: { _id: record._id, familyUserId },
      update: { $set: { status: 'archived' } },
    },
  })),
);
~~~

It returns operation counts. It is not automatically a transaction; use a session if all-or-nothing behavior is required.

## Common mistakes

- Forgetting `await` and receiving a Query/Promise instead of results.
- Expecting `find()` to return `null`; it returns an array.
- Expecting `updateOne()` to return the updated document.
- Forgetting `new: true` on `findOneAndUpdate`.
- Updating by `_id` without an ownership condition.
- Trusting `request.body` as a MongoDB filter/update without allow-listing fields.
- Replacing a nested object when only one dotted field should change.
- Using an unbounded `find()` for a growing collection.
- Using raw search text in `$regex`.
- Assuming `populate()` always finds a referenced document.
- Using an upsert for uniqueness without a unique index.

## Viva-ready distinctions

- **MongoDB versus Mongoose:** MongoDB is the database; Mongoose supplies Node.js schemas, models, validation, middleware, and query APIs.
- **Document versus plain object:** a Mongoose document has methods such as `save()`; `.lean()` and aggregation return plain objects.
- **Atomic update:** the database checks the filter and applies the update as one operation, avoiding a read-then-write race for that document.
- **Embedding versus referencing:** embed tightly owned small data; reference independently managed/reused data.
- **`$set` versus assignment plus `save()`:** `$set` is an update operator; assignment changes an in-memory document that must then be saved.

## Live-test query sequence

~~~text
1. Choose the model.
2. Build a filter with ID + ownership + allowed state.
3. Validate/convert params, query, and body values.
4. Choose read, create, update, delete/archive, or aggregate.
5. Add update operators and options deliberately.
6. Await the query.
7. Handle [] or null or operation counts correctly.
8. Return the standard API response.
~~~

When stuck, search the existing code for the nearest pattern:

~~~powershell
rg -n 'findOneAndUpdate|updateOne|\$set|\$push|populate|aggregate' backend
rg -n 'countDocuments|skip\(|limit\(|lean\(' backend
rg -n 'schema.index|upsert|withTransaction|bulkWrite' backend
~~~

Never copy a query until you identify which parts are variables: model name, ownership field, route ID, allowed status, update fields, populate path, sort field, and response name.
