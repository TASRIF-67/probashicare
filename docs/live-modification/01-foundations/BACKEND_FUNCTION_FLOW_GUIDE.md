# Backend Function Flow and Execution Sequence

This guide answers one question:

> When a backend function contains many operations, what runs first, what runs next, and why?

## The most important sequence

For most Express controllers, remember:

~~~text
Receive request
→ Read input
→ Validate input
→ Check authentication and permission
→ Read required database data
→ Apply business rules
→ Write database changes
→ Perform related side effects
→ Send one response
~~~

A shorter exam mnemonic is:

~~~text
Input → Validate → Permission → Query → Decide → Save → Side effect → Response
~~~

Not every controller needs every step. A list controller may only need input, permission, query, and response. Keep the steps that the requirement needs and preserve their logical order.

## Number the intentions before writing code

When a function feels large, write its main intentions as comments first:

~~~javascript
export async function updateRecord(request, response) {
  // Step 1: Read request input.

  // Step 2: Validate the input.

  // Step 3: Build an ownership filter.

  // Step 4: Load the caller-owned record.

  // Step 5: Enforce the status/business rule.

  // Step 6: Save the change.

  // Step 7: Create any related notification.

  // Step 8: Send the success response.
}
~~~

Then fill one section at a time. These intention comments are especially useful during the live test because they show both you and the examiner that you understand the flow.

## A complete controller with visible sequence

~~~javascript
/**
 * Marks one caller-owned notification as read.
 *
 * @param {import("express").Request} request - Authenticated request.
 * @param {import("express").Response} response - Express response.
 * @returns {Promise<void>} Resolves after sending the response.
 * @sideEffects Updates one Notification document.
 */
export async function markNotificationRead(request, response) {
  // Step 1: Read the identifier from the URL.
  const notificationId = request.params.notificationId;

  // Step 2: Validate the identifier before querying MongoDB.
  if (!mongoose.isValidObjectId(notificationId)) {
    throw new ApiError(404, "Notification not found.");
  }

  // Step 3: Build the permission filter.
  // The recipient must be the currently authenticated user.
  const ownershipFilter = {
    _id: notificationId,
    recipient: request.user._id,
  };

  // Step 4: Describe the database change.
  const update = {
    $set: {
      readAt: new Date(),
    },
  };

  // Step 5: Execute one atomic ownership check and update.
  const notification = await Notification.findOneAndUpdate(
    ownershipFilter,
    update,
    {
      new: true,
    },
  );

  // Step 6: Handle missing and unauthorized records identically.
  if (!notification) {
    throw new ApiError(404, "Notification not found.");
  }

  // Step 7: Return exactly one response.
  response.json({
    success: true,
    data: {
      notification,
    },
  });
}
~~~

The actual execution is top to bottom. The function pauses at await until the database operation finishes. If an error is thrown, normal execution stops and Express error handling takes over.

## Where request data comes from

Read input near the beginning of the controller:

~~~javascript
const profileId = request.params.profileId;
const page = request.query.page;
const title = request.body.title;
const currentUserId = request.user._id;
~~~

Use this map:

| Source | Meaning | Example |
| --- | --- | --- |
| request.params | Identifier inside the URL path | /profiles/:profileId |
| request.query | Optional filters after the question mark | ?page=2&status=active |
| request.body | Submitted JSON or form data | title, status, notes |
| request.user | User attached by authentication middleware | role, user ID, email |

These are properties of Express's `request` object; they are not functions and do not independently return values. Express and earlier middleware fill them before the controller runs.

### One request mapped to all four sources

Assume the route and incoming request are:

~~~javascript
router.patch('/:profileId', requireAuth, updateProfile);

// PATCH /api/profiles/abc123?notify=true
// JSON body: { name: 'Masnun', age: 68 }
~~~

The controller reads:

~~~javascript
const currentUser = request.user;
const profileId = request.params.profileId;
const notifyValue = request.query.notify;
const submittedName = request.body.name;
~~~

Typical values are:

~~~javascript
request.user;   // Authenticated user/document attached by requireAuth.
request.params; // { profileId: 'abc123' }
request.query;  // { notify: 'true' }
request.body;   // { name: 'Masnun', age: 68 }
~~~

Easy memory rule:

~~~text
user   = who sent the request
params = which resource is named in the path
query  = optional filters/settings after ?
body   = submitted data
~~~

### Important types and safety rules

- `request.user` is not built into Express. Authentication middleware verifies the token and assigns it. It may be a Mongoose document or a plain object, depending on that middleware.
- `request.params` values are strings. The route name `:profileId` must match `request.params.profileId`.
- `request.query` values normally arrive as strings. Convert numbers and booleans deliberately.
- `request.body` contains parsed JSON only when middleware such as `express.json()` is configured. JSON can contain strings, numbers, booleans, arrays, and objects.
- All client-controlled input must be validated before database use.

~~~javascript
const page = Number.parseInt(request.query.page, 10) || 1;
const shouldNotify = request.query.notify === 'true';
const title = String(request.body.title || '').trim();

if (!mongoose.isValidObjectId(request.params.profileId)) {
  throw new ApiError(404, 'Profile not found.');
}
~~~

Destructuring is only shorter property access:

~~~javascript
const { profileId } = request.params;
const { page = '1', status = 'all' } = request.query;
const { name, age } = request.body;

// Equivalent example:
const sameProfileId = request.params.profileId;
~~~

Do not accept an owner ID from request.body when request.user already identifies the owner.

### What the response object does

Express passes `request` and `response` into the controller. The controller reads from `request` and sends the result through `response`.

~~~javascript
response.status(201).json({
  success: true,
  data: {
    profile,
  },
});
~~~

Read it left to right:

1. `status(201)` selects the HTTP status and returns the same response object.
2. Because it returns that object, `.json(...)` can be chained.
3. `json(...)` converts the JavaScript object into JSON and ends the response.

Common forms:

~~~javascript
response.json(data);             // Default status 200.
response.status(201).json(data); // A resource was created.
response.status(204).end();      // Success with no response body.
~~~

Send only one response. If an early branch sends a response, return so later code cannot send another:

~~~javascript
if (!record) {
  return response.status(404).json({
    success: false,
    error: { message: 'Record not found.' },
  });
}
~~~

In ProbashiCare, controllers commonly `throw new ApiError(...)` instead; `asyncHandler` forwards it to centralized error middleware. `next(error)` is the lower-level Express equivalent.

## Flow for common controller types

### GET list

~~~text
Read query
→ normalize page/filter values
→ create ownership filter
→ run find/count queries
→ format records
→ return list and pagination
~~~

~~~javascript
export async function listRecords(request, response) {
  // Step 1: Read and normalize pagination input.
  const page = Number.parseInt(request.query.page, 10) || 1;
  const limit = 3;
  const skip = (page - 1) * limit;

  // Step 2: Restrict results to the signed-in user.
  const ownershipFilter = {
    familyUserId: request.user._id,
  };

  // Step 3: Start two independent read operations together.
  const results = await Promise.all([
    Example.find(ownershipFilter)
      .sort({
        createdAt: -1,
      })
      .skip(skip)
      .limit(limit),
    Example.countDocuments(ownershipFilter),
  ]);

  // Step 4: Give each result a readable name.
  const records = results[0];
  const total = results[1];
  const pages = Math.max(1, Math.ceil(total / limit));

  // Step 5: Return the data in the agreed API shape.
  response.json({
    success: true,
    data: {
      records,
      pagination: {
        page,
        limit,
        total,
        pages,
      },
    },
  });
}
~~~

Promise.all is appropriate here because neither query depends on the result of the other.

### GET one

~~~text
Validate ID
→ query by ID plus ownership
→ handle concealed 404
→ format record
→ respond
~~~

~~~javascript
export async function getRecord(request, response) {
  // Step 1: Read and validate the route parameter.
  const recordId = request.params.recordId;

  if (!mongoose.isValidObjectId(recordId)) {
    throw new ApiError(404, "Record not found.");
  }

  // Step 2: Query by identity and ownership together.
  const record = await Example.findOne({
    _id: recordId,
    familyUserId: request.user._id,
  });

  // Step 3: Conceal missing and unauthorized records with the same response.
  if (!record) {
    throw new ApiError(404, "Record not found.");
  }

  // Step 4: Return the authorized record.
  response.json({
    success: true,
    data: {
      record,
    },
  });
}
~~~

### POST create

~~~text
Read validated body
→ check linked resource/permission
→ check duplicate rule
→ create document
→ perform side effect
→ return 201
~~~

~~~javascript
export async function createRecord(request, response) {
  // Step 1: Read fields that validation middleware already normalized.
  const input = request.recordInput;

  // Step 2: Verify access to the related elderly profile.
  await getAuthorizedElderlyProfile({
    profileId: input.elderlyProfileId,
    familyUserId: request.user._id,
    permissions: ["owner", "editor"],
  });

  // Step 3: Build data controlled by the backend.
  const recordInput = {
    familyUserId: request.user._id,
    elderlyProfileId: input.elderlyProfileId,
    title: input.title,
    status: "active",
  };

  // Step 4: Create the database document.
  const record = await Example.create(recordInput);

  // Step 5: Return 201 because a resource was created.
  response.status(201).json({
    success: true,
    data: {
      record,
    },
  });
}
~~~

### PATCH update or status change

~~~text
Validate ID/body
→ query by ID plus ownership and allowed current state
→ update atomically
→ handle not found/stale state
→ notify related user
→ respond
~~~

Put ownership and allowed status inside findOneAndUpdate whenever possible. That prevents another request from changing the record between a separate find and save.

### DELETE versus archive

Hard deletion flow:

~~~text
Validate ID
→ delete by ID plus ownership
→ handle missing record
→ remove dependent records if required
→ respond
~~~

Archive flow:

~~~text
Validate ID
→ update caller-owned active record
→ set status and archivedAt
→ keep historical data
→ respond
~~~

Use the behavior already established by the project. Do not replace archive with deletion during a live modification unless the question explicitly asks for it.

## Middleware has its own exact sequence

Routes execute from left to right:

~~~javascript
router.post(
  "/",
  asyncHandler(requireAuth),
  allowRoles("family"),
  validateRecord,
  asyncHandler(createRecord),
);
~~~

Execution:

~~~text
1. requireAuth attaches request.user
2. allowRoles checks request.user.role
3. validateRecord checks and normalizes request.body
4. createRecord applies business and database logic
5. the controller sends the response
~~~

next() moves to the next middleware. throw stops the normal path and sends control to error handling. A middleware that already sent a response must not call next afterward.

## Service-function flow

A service handles reusable business logic, external APIs, or a group of database operations. A controller should read HTTP input and send HTTP output; a service should normally return data or throw an error.

~~~javascript
/**
 * Generates a wellness insight with a safe fallback.
 */
export async function generateWellnessInsight(profileId) {
  // Step 1: Read submitted reports needed for analysis.
  const reports = await WellnessReport.find({
    elderlyProfileId: profileId,
    status: "submitted",
  }).sort({
    visitDate: -1,
  });

  // Step 2: Stop when the business operation has no usable input.
  if (reports.length === 0) {
    throw new ApiError(
      422,
      "No submitted wellness reports are available.",
    );
  }

  // Step 3: Build deterministic local analysis first.
  const analysis = analyzeWellnessReportValues(reports);

  // Step 4: Attempt the optional external provider.
  const geminiSummary =
    await generateGeminiWellnessSummary(reports);

  // Step 5: Choose the provider result or safe fallback explicitly.
  let generatedBy = "gemini";
  let summaryData = geminiSummary;

  if (!summaryData) {
    generatedBy = "fallback";
    summaryData = buildFallbackWellnessSummary(analysis);
  }

  // Step 6: Save the final result in one consistent schema.
  const insight = await WellnessInsight.create({
    elderlyProfileId: profileId,
    summary: summaryData.summary,
    highlights: summaryData.highlights,
    recommendedFollowUp: summaryData.recommendedFollowUp,
    generatedBy,
  });

  // Step 7: Return data to the controller; do not send an HTTP response here.
  return {
    insight,
    generatedBy,
  };
}
~~~

## Database query sequence

A Mongoose query can be built across several lines:

~~~javascript
const query = Notification.find({
  recipient: request.user._id,
});

query.sort({
  createdAt: -1,
});

query.limit(3);

const notifications = await query;
~~~

The first lines describe the query. The await executes it and pauses until MongoDB returns the result.

Many common calls execute immediately when awaited:

~~~javascript
const user = await User.findById(userId);
const records = await Example.find(filter);
const count = await Example.countDocuments(filter);
const updated = await Example.findOneAndUpdate(filter, update, options);
await record.save();
~~~

## Transaction flow

Use a transaction when several related writes must either all succeed or all fail:

~~~javascript
const session = await mongoose.startSession();

try {
  await session.withTransaction(async () => {
    // Step 1: Create or update the main record.
    const payment = await SubscriptionPayment.create(
      [paymentInput],
      {
        session,
      },
    );

    // Step 2: Update the related subscription in the same transaction.
    await FamilySubscription.updateOne(
      {
        familyUserId,
      },
      {
        $set: {
          status: "active",
        },
      },
      {
        session,
      },
    );

    // Step 3: Create the related notification in the same transaction.
    await createNotification({
      recipientUserId: familyUserId,
      title: "Premium activated",
      session,
    });
  });
} finally {
  // Step 4: Always release the MongoDB session.
  await session.endSession();
}
~~~

Execution is still ordered inside the callback. If step 2 throws, step 1 and step 3 are not committed.

## Control-flow rules that determine sequence

### return

return immediately ends the current function:

~~~javascript
if (!record) {
  return null;
}

// This line runs only when record exists.
return formatRecord(record);
~~~

### throw

throw stops the current path and moves to error handling:

~~~javascript
if (!record) {
  throw new ApiError(404, "Record not found.");
}

// This line does not execute after the error.
record.status = "active";
~~~

### await

await pauses only the current async function until the Promise settles:

~~~javascript
const record = await Example.findById(recordId);

// This executes after the query succeeds.
return record;
~~~

### try, catch, finally

~~~javascript
try {
  // Normal operation.
  await performWork();
} catch (error) {
  // Runs only if try throws.
  throw normalizeError(error);
} finally {
  // Runs after success or failure.
  await releaseResource();
}
~~~

### if and else

Only one matching branch executes:

~~~javascript
if (status === "completed") {
  // Completed-status logic.
} else {
  // Every other status.
}
~~~

### loops

A for...of loop with await processes items one at a time:

~~~javascript
for (const userId of recipientIds) {
  await createNotification({
    recipientUserId: userId,
  });
}
~~~

This is sequential. Use it when order, transactions, or provider limits matter.

## When the flow is not simply top to bottom

Most code is sequential, but these cases create branches:

| Construct | What happens |
| --- | --- |
| if/else | Only one branch runs |
| return | Current function ends immediately |
| throw | Normal path ends and error handling begins |
| await | Current function pauses until a Promise settles |
| Promise.all | Independent operations run concurrently |
| callback | Runs when the surrounding API invokes it |
| middleware next() | Continues to the next route function |
| transaction callback | Runs now, but commits only after the callback succeeds |

Do not confuse source-code position with invocation time. A helper function can be defined near the top of a file but execute later when a controller calls it.

## File-loading flow versus request flow

When Node imports a module:

~~~text
1. Imports are resolved
2. Top-level constants and schemas are created
3. Function declarations become available
4. Exported values are returned to the importing file
~~~

A controller function body does not run merely because its file was imported. It runs later when its Express route receives a matching request.

## How to trace a large existing controller

Use this method:

1. Find the exported controller named in the route.
2. Write down params, query, body, and request.user fields.
3. Circle every await; these are database or external boundaries.
4. Mark every return and throw; these end a path.
5. Mark every if/else; these create alternative paths.
6. Identify the final response.json call.
7. Open only the helper/service functions called by that controller.
8. Explain the flow aloud using the numbered intentions.

Use this tracing sheet:

~~~text
Function:
Called by route:
Actor:
Input:
Validation:
Permission filter:
Reads:
Business decision:
Writes:
Side effects:
Response:
Errors:
~~~

## Exam-safe backend skeleton

~~~javascript
/**
 * Explains the controller's single responsibility.
 */
export async function controllerName(request, response) {
  // Step 1: Read input.
  const recordId = request.params.recordId;
  const input = request.body;

  // Step 2: Validate input.
  if (!mongoose.isValidObjectId(recordId)) {
    throw new ApiError(404, "Record not found.");
  }

  // Step 3: Apply ownership permission.
  const ownershipFilter = {
    _id: recordId,
    familyUserId: request.user._id,
  };

  // Step 4: Read or atomically change the database record.
  const record = await Example.findOne(ownershipFilter);

  // Step 5: Handle missing or unauthorized data.
  if (!record) {
    throw new ApiError(404, "Record not found.");
  }

  // Step 6: Apply the required business rule.
  record.title = input.title;

  // Step 7: Persist the change.
  await record.save();

  // Step 8: Return one predictable response.
  response.json({
    success: true,
    data: {
      record,
    },
  });
}
~~~

Before copying it, replace Example, ownership fields, input fields, error messages, and response keys with names that already exist in the project.
