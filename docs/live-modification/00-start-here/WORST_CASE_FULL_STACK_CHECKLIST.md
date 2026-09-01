# Worst-Case Full-Stack Implementation Checklist

Use this guide when the exam asks for a frontend, backend, and database feature and you do not know where to begin.

When you are unsure which folder owns a piece of code, check [PROJECT_STRUCTURE_AND_FILE_RESPONSIBILITIES.md](PROJECT_STRUCTURE_AND_FILE_RESPONSIBILITIES.md).

Do not try to understand the whole repository. Complete one small vertical flow from MongoDB to the screen.

## Emergency rule

Follow this order:

~~~text
Understand one sentence
  -> find nearest existing feature
  -> write API contract
  -> model/schema
  -> validation and permission
  -> controller
  -> route and app registration
  -> test backend
  -> frontend service
  -> React page
  -> loading/error/empty/success
  -> build and explain
~~~

If the question does not require a new collection, skip the new-model step and use the existing model.

## Step 0: protect your starting point

~~~powershell
git status --short --branch
git diff --stat
~~~

Write down files that were already modified. Do not reset, restore, stash, or stage unrelated work.

## Step 1: translate the question into seven answers

Copy and fill this:

~~~yaml
Feature:
Actor:
Action:
Data:
Storage:
Permission:
Screen result:
~~~

Definitions:

- Feature: what is changing?
- Actor: Family, Caregiver, Admin, or public user?
- Action: view, create, update, archive, or change status?
- Data: which exact fields enter or leave the system?
- Storage: existing model or new collection?
- Permission: who owns or may see/change the record?
- Screen result: what must the user see after success?

Example:

~~~yaml
Feature: Family care notes
Actor: family
Action: create and view
Data: elderlyProfileId, title, note
Storage: new CareNote collection
Permission: authorized Family owner or editor
Screen result: form plus newest notes
~~~

## Step 2: decide which layers are required

| Requirement clue | Required layer |
| --- | --- |
| Change text, color, layout, or existing button | Frontend only |
| Show an existing response field | Frontend, possibly service |
| Return a new calculated value | Backend controller/query plus frontend |
| Save a new field in an existing document | Existing model, validation, controller, frontend |
| Store independent history records | New model plus full stack |
| Read another collection | Controller/service query plus frontend |
| Add a new action or status | Validation, atomic controller update, frontend action |
| Add a completely new page and endpoint | Full stack |

When uncertain, assume the feature needs:

~~~text
model or existing model
route
validation
controller
frontend service
React page/component
~~~

## Step 3: find the nearest working feature

Search by the closest noun or action:

~~~powershell
rg -n "similar visible text" frontend/src
rg -n "similar-route-name" backend/routes frontend/src/services
rg -n "SimilarModel|similarField" backend
~~~

Open this chain:

~~~text
React page
  -> imported frontend service
  -> API URL
  -> Express route
  -> middleware
  -> controller
  -> model
~~~

Copy its structure. Do not copy its permission rules without checking the new actor.

## Step 4: write the API contract

Fill this before coding:

~~~yaml
Feature:
Actor:

Method:
URL:

Authentication:
Role:
Resource permission:

Params:
Query:
Body:

Success status:
Success response:

Possible errors:
- 401:
- 403:
- 404:
- 409:
- 422:

Database model:
Database filter:
Database operation:

Frontend page:
Frontend service:
~~~

Example create contract:

~~~yaml
Feature: Create care note
Actor: family

Method: POST
URL: /api/care-notes

Authentication: required
Role: family
Resource permission: owner or editor of elderly profile

Body:
  elderlyProfileId: MongoDB ID
  title: required text
  note: required text

Success status: 201
Success response:
  success: true
  data:
    record: created care note

Errors:
  401: not authenticated
  403: wrong role
  404: elderly profile unavailable or unauthorized
  422: invalid fields

Database model: CareNote
Database operation: create one document

Frontend page: CareNotesPage
Frontend service: careNoteService.createRecord
~~~

The frontend service, route, controller, and response must use this exact method, URL, field names, and response shape.

# Complete generic vertical slice

The following example creates and lists a simple elderly-related record. Replace every placeholder listed in the replacement table.

## JSDoc template for every named function

Use this above each new named function and replace every description:

~~~js
/**
 * Explains exactly what this function does.
 * @param {string} value - Explains the parameter and expected type.
 * @returns {Promise<object>|void} Explains the exact returned result.
 * @sideEffects Explains API, database, navigation, or state changes.
 */
~~~

Do not add a fake parameter when a function accepts none. Use an exact return shape whenever it is known.
## Step 5: create the model only when needed

File:

~~~text
backend/models/ExampleRecord.js
~~~

~~~js
import mongoose from "mongoose";

const exampleRecordSchema =
  new mongoose.Schema(
    {
      familyUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
      },
      elderlyProfileId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ElderlyProfile",
        required: true,
        index: true,
      },
      title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
      },
      details: {
        type: String,
        trim: true,
        maxlength: 1000,
        default: "",
      },
      status: {
        type: String,
        enum: [
          "active",
          "archived",
        ],
        default: "active",
        index: true,
      },
    },
    {
      timestamps: true,
    },
  );

exampleRecordSchema.index({
  familyUserId: 1,
  elderlyProfileId: 1,
  status: 1,
  createdAt: -1,
});

export const ExampleRecord =
  mongoose.model(
    "ExampleRecord",
    exampleRecordSchema,
  );
~~~

If the required data already belongs inside ElderlyProfile or another model, add only the required schema field there. Do not create a new collection automatically.

## Step 6: validate the request

File:

~~~text
backend/middleware/validateExampleRecord.js
~~~

~~~js
import mongoose from "mongoose";
import { ApiError } from "../utils/ApiError.js";

/**
 * Validates and normalizes the example-record request body.
 * @param {import("express").Request} request - Incoming request.
 * @param {import("express").Response} _response - Unused Express response.
 * @param {import("express").NextFunction} next - Continues middleware.
 * @returns {void} This middleware returns no value.
 * @sideEffects Replaces normalized request.body fields or throws ApiError.
 */
export function validateExampleRecord(
  request,
  _response,
  next,
) {
  const errors = {};

  const elderlyProfileId =
    String(
      request.body.elderlyProfileId || "",
    ).trim();

  const title =
    String(request.body.title || "").trim();

  const details =
    String(request.body.details || "").trim();

  if (
    !mongoose.isValidObjectId(
      elderlyProfileId,
    )
  ) {
    errors.elderlyProfileId =
      "Select a valid elderly profile.";
  }

  if (!title) {
    errors.title = "Title is required.";
  }

  if (title.length > 120) {
    errors.title =
      "Title must be 120 characters or fewer.";
  }

  if (details.length > 1000) {
    errors.details =
      "Details must be 1000 characters or fewer.";
  }

  if (Object.keys(errors).length > 0) {
    throw new ApiError(
      422,
      "Please correct the information.",
      errors,
    );
  }

  request.body.elderlyProfileId =
    elderlyProfileId;

  request.body.title = title;
  request.body.details = details;

  next();
}
~~~

Validation checks input shape. Permission checks whether the authenticated user may use the selected elderly profile. Both are required.

## Step 7: authorize the private resource

Use the existing elderly-profile access service when possible. If you need to understand the query, the basic shape is:

~~~js
const link =
  await ElderlyFamilyLink.findOne({
    elderlyProfileId,
    familyUserId: request.user._id,
    status: "active",
    permission: {
      $in: [
        "owner",
        "editor",
      ],
    },
  }).lean();

if (!link) {
  throw new ApiError(
    404,
    "Elderly profile not found.",
  );
}
~~~

Use owner, editor, and viewer for reads. Use owner/editor for changes. Use owner alone for archive or access management.

A concealed 404 avoids revealing another Family's private profile.

## Step 8: create the controllers

File:

~~~text
backend/controllers/exampleRecordController.js
~~~

Create:

~~~js
import { ExampleRecord } from "../models/ExampleRecord.js";
import { ElderlyFamilyLink } from "../models/ElderlyFamilyLink.js";
import { ApiError } from "../utils/ApiError.js";

/**
 * Creates one caller-owned record after elderly-profile authorization.
 * @param {import("express").Request} request - Authenticated Family request.
 * @param {import("express").Response} response - Express response.
 * @returns {Promise<void>} Resolves after sending the response.
 * @sideEffects Reads the access link and creates one MongoDB document.
 */
export async function createExampleRecord(
  request,
  response,
) {
  const elderlyProfileId =
    request.body.elderlyProfileId;

  const link =
    await ElderlyFamilyLink.findOne({
      elderlyProfileId,
      familyUserId: request.user._id,
      status: "active",
      permission: {
        $in: [
          "owner",
          "editor",
        ],
      },
    }).lean();

  if (!link) {
    throw new ApiError(
      404,
      "Elderly profile not found.",
    );
  }

  const record =
    await ExampleRecord.create({
      familyUserId: request.user._id,
      elderlyProfileId,
      title: request.body.title,
      details: request.body.details,
      status: "active",
    });

  response.status(201).json({
    success: true,
    data: {
      record,
    },
  });
}
~~~

List only authorized caller-owned records:

~~~js
/**
 * Lists active records owned by the authenticated Family.
 * @param {import("express").Request} request - Authenticated Family request.
 * @param {import("express").Response} response - Express response.
 * @returns {Promise<void>} Resolves after sending records.
 * @sideEffects Reads MongoDB.
 */
export async function listExampleRecords(
  request,
  response,
) {
  const filter = {
    familyUserId: request.user._id,
    status: "active",
  };

  if (request.query.elderlyProfileId) {
    filter.elderlyProfileId =
      request.query.elderlyProfileId;
  }

  const records =
    await ExampleRecord.find(filter)
      .sort({
        createdAt: -1,
      })
      .limit(20)
      .lean();

  response.json({
    success: true,
    data: {
      records,
      count: records.length,
    },
  });
}
~~~

Never accept familyUserId from request.body. Derive it from request.user.

## Step 9: add the routes

File:

~~~text
backend/routes/exampleRecordRoutes.js
~~~

~~~js
import { Router } from "express";
import {
  createExampleRecord,
  listExampleRecords,
} from "../controllers/exampleRecordController.js";
import {
  allowRoles,
  requireAuth,
} from "../middleware/auth.js";
import {
  validateExampleRecord,
} from "../middleware/validateExampleRecord.js";
import {
  asyncHandler,
} from "../utils/asyncHandler.js";

const router = Router();

router.use(asyncHandler(requireAuth));
router.use(allowRoles("family"));

router.get(
  "/",
  asyncHandler(listExampleRecords),
);

router.post(
  "/",
  validateExampleRecord,
  asyncHandler(createExampleRecord),
);

export default router;
~~~

Middleware order is authentication, role/entitlement, validation, then controller.

## Step 10: register the route group

In backend/app.js:

~~~js
import exampleRecordRoutes from
  "./routes/exampleRecordRoutes.js";

app.use(
  "/api/example-records",
  exampleRecordRoutes,
);
~~~

Do not add /api twice. The frontend shared Axios base URL already contains /api.

## Step 11: check and test the backend first

~~~powershell
node --check backend/models/ExampleRecord.js
node --check backend/middleware/validateExampleRecord.js
node --check backend/controllers/exampleRecordController.js
node --check backend/routes/exampleRecordRoutes.js
npm.cmd start --prefix backend
~~~

Test with Thunder Client:

~~~http
POST http://localhost:5034/api/example-records
Content-Type: application/json
Cookie: authenticated session cookie

{
  "elderlyProfileId": "VALID_PROFILE_ID",
  "title": "Morning care note",
  "details": "Medicine was taken after breakfast."
}
~~~

Expected:

~~~json
{
  "success": true,
  "data": {
    "record": {
      "_id": "...",
      "title": "Morning care note"
    }
  }
}
~~~

Test invalid input and an unauthorized elderlyProfileId before building the UI.

## Step 12: create the frontend service

File:

~~~text
frontend/src/services/exampleRecordService.js
~~~

~~~js
import { api } from "./api.js";

/**
 * Lists records for an optional elderly profile.
 * @param {string|undefined} elderlyProfileId - Optional profile filter.
 * @returns {Promise<{records: object[], count: number}>} Authorized records.
 * @sideEffects Sends an authenticated GET request.
 */
async function listRecords(
  elderlyProfileId,
) {
  const response = await api.get(
    "/example-records",
    {
      params: {
        elderlyProfileId,
      },
    },
  );

  return response.data.data;
}

/**
 * Creates one example record.
 * @param {{elderlyProfileId: string, title: string, details: string}} payload - Form values.
 * @returns {Promise<{record: object}>} Created record wrapper.
 * @sideEffects Sends an authenticated POST request and writes MongoDB.
 */
async function createRecord(payload) {
  const response = await api.post(
    "/example-records",
    payload,
  );

  return response.data.data;
}

export const exampleRecordService = {
  listRecords,
  createRecord,
};
~~~

Check that method, path, request fields, and response fields exactly match the contract.

## Step 13: create the React page

File:

~~~text
frontend/src/pages/family/ExampleRecordsPage.jsx
~~~

~~~jsx
import {
  useEffect,
  useState,
} from "react";
import {
  normalizeApiError,
} from "../../services/api.js";
import {
  exampleRecordService,
} from "../../services/exampleRecordService.js";

/**
 * Displays and creates caller-authorized example records.
 * @returns {import("react").ReactElement} Complete record page.
 * @sideEffects Loads and creates records through the backend API.
 */
export function ExampleRecordsPage() {
  const [records, setRecords] =
    useState([]);

  const [form, setForm] =
    useState({
      elderlyProfileId: "",
      title: "",
      details: "",
    });

  const [loading, setLoading] =
    useState(true);

  const [submitting, setSubmitting] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let ignoreResult = false;

    /**
     * Loads records for the selected elderly profile.
     * @returns {Promise<void>} Resolves after state synchronization.
     * @sideEffects Sends an API request and updates React state.
     */
    async function loadRecords() {
      setLoading(true);
      setError("");

      try {
        const data =
          await exampleRecordService.listRecords(
            form.elderlyProfileId || undefined,
          );

        if (!ignoreResult) {
          setRecords(data.records);
        }
      } catch (requestError) {
        if (!ignoreResult) {
          const normalizedError =
            normalizeApiError(requestError);

          setError(
            normalizedError.message,
          );
        }
      } finally {
        if (!ignoreResult) {
          setLoading(false);
        }
      }
    }

    loadRecords();

    /**
     * Prevents a late request result from updating an inactive effect.
     * @returns {void} This cleanup returns no value.
     * @sideEffects Changes the closure flag used by loadRecords.
     */
    return function cleanup() {
      ignoreResult = true;
    };
  }, [form.elderlyProfileId]);

  /**
   * Stores one controlled form-field value.
   * @param {import("react").ChangeEvent<HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement>} event - Field change.
   * @returns {void} This handler returns no value.
   * @sideEffects Updates local form state.
   */
  function handleChange(event) {
    const fieldName =
      event.target.name;

    const fieldValue =
      event.target.value;

    setForm((currentForm) => {
      return {
        ...currentForm,
        [fieldName]: fieldValue,
      };
    });
  }

  /**
   * Submits the controlled example-record form.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Form submit event.
   * @returns {Promise<void>} Resolves after the request finishes.
   * @sideEffects Prevents reload, calls the API, and updates React state.
   */
  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const data =
        await exampleRecordService.createRecord(
          form,
        );

      setRecords((currentRecords) => {
        return [
          data.record,
          ...currentRecords,
        ];
      });

      setForm((currentForm) => {
        return {
          ...currentForm,
          title: "",
          details: "",
        };
      });
    } catch (requestError) {
      const normalizedError =
        normalizeApiError(requestError);

      setError(normalizedError.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main>
      <h1>Care notes</h1>

      <form onSubmit={handleSubmit}>
        <label htmlFor="elderly-profile">
          Elderly profile
        </label>
        <select
          id="elderly-profile"
          name="elderlyProfileId"
          value={form.elderlyProfileId}
          onChange={handleChange}
          required={true}
        >
          <option value="">
            Select a profile
          </option>
        </select>

        <label htmlFor="record-title">
          Title
        </label>
        <input
          id="record-title"
          name="title"
          value={form.title}
          onChange={handleChange}
          required={true}
        />

        <label htmlFor="record-details">
          Details
        </label>
        <textarea
          id="record-details"
          name="details"
          value={form.details}
          onChange={handleChange}
        />

        <button
          type="submit"
          disabled={submitting}
        >
          {submitting
            ? "Saving..."
            : "Save note"}
        </button>
      </form>

      {error ? (
        <p role="alert">{error}</p>
      ) : null}

      {loading ? (
        <p>Loading notes...</p>
      ) : null}

      {!loading &&
      records.length === 0 ? (
        <p>No notes yet.</p>
      ) : null}

      {!loading &&
      records.length > 0 ? (
        <ul>
          {records.map((record) => {
            return (
              <li key={record._id}>
                <strong>
                  {record.title}
                </strong>
                <p>{record.details}</p>
              </li>
            );
          })}
        </ul>
      ) : null}
    </main>
  );
}
~~~

The select still needs real profile options. Copy the existing elderly-profile loading pattern rather than hard-coding profile IDs.

## Step 14: add frontend route and navigation

In frontend/src/App.jsx:

~~~jsx
<Route
  path="/example-records"
  element={
    <ProtectedRoute
      allowedRoles={["family"]}
    >
      <ExampleRecordsPage />
    </ProtectedRoute>
  }
/>
~~~

Add a NavLink only if the requirement needs permanent navigation. A small action may belong inside an existing page instead.

## Step 15: replacement checklist

Replace every item:

~~~text
ExampleRecord
exampleRecord
exampleRecords
example-records
ExampleRecordsPage
ExampleRecord.js
family
familyUserId
elderlyProfileId
title
details
active
/api/example-records
success response fields
permission levels
visible labels
~~~

Then verify imports point to real files and model export names match imports exactly.

# Common requirement variations

## Variation A: add one field to an existing feature

Do not create a new model.

Update in this order:

~~~text
existing schema
  -> validation
  -> create/update controller assignment
  -> API response if projection excludes it
  -> frontend initial form
  -> input handler/JSX
  -> display
~~~

## Variation B: show data from another collection

Authorize the main resource first, then query the related collection:

~~~js
const profile =
  await getAuthorizedElderlyProfile(
    request.user._id,
    profileId,
    [
      "owner",
      "editor",
      "viewer",
    ],
  );

const reportCount =
  await WellnessReport.countDocuments({
    elderlyProfileId: profile._id,
    status: "submitted",
  });

response.json({
  success: true,
  data: {
    profile,
    reportCount,
  },
});
~~~

## Variation C: add a status button

Backend must control allowed old state:

~~~js
const record =
  await ExampleRecord.findOneAndUpdate(
    {
      _id: recordId,
      familyUserId: request.user._id,
      status: "active",
    },
    {
      $set: {
        status: "archived",
        archivedAt: new Date(),
      },
    },
    {
      new: true,
      runValidators: true,
    },
  );

if (!record) {
  throw new ApiError(
    409,
    "Only an active record can be archived.",
  );
}
~~~

Frontend calls the endpoint, disables the button, and replaces or reloads the record.

## Variation D: dashboard count

~~~js
const count =
  await ExampleRecord.countDocuments({
    familyUserId: request.user._id,
    status: "active",
  });
~~~

Return the count inside data and render it in an existing dashboard card.

## Variation E: notify after success

~~~js
await createNotification({
  userId: recipientUserId,
  actorUserId: request.user._id,
  type: "example_created",
  title: "New care update",
  message: "A new care record was added.",
  actionPath: "/example-records",
  relatedModel: "ExampleRecord",
  relatedId: record._id,
  eventKey:
    "example_created:" +
    record._id.toString(),
});
~~~

Use a stable eventKey so repeated execution does not create duplicate notifications.

## Variation F: Premium feature

Protect the backend route:

~~~js
router.get(
  "/premium-summary",
  requireFamilyEntitlement(
    "wellness_insights",
  ),
  asyncHandler(getPremiumSummary),
);
~~~

Frontend redirects Core users to /subscription. Backend middleware remains the real security.

## Variation G: external API

Use this order:

~~~text
authorize
  -> query only required data
  -> sanitize
  -> call provider with timeout
  -> validate provider response
  -> use fallback on failure
  -> save truthful source
  -> return result
~~~

Copy the full provider block from the backend copy-paste guide.

# Copilot prompts for each step

Write one comment at a time:

~~~js
// Define a Mongoose model for caller-owned elderly care notes.
~~~

~~~js
// Validate elderlyProfileId, required title, and bounded details.
~~~

~~~js
// Confirm the current Family is an owner or editor of this elderly profile.
~~~

~~~js
// Create one record using request.user._id instead of a client owner ID.
~~~

~~~js
// Return caller-owned active records newest first.
~~~

~~~js
// Call POST /example-records and return response.data.data.
~~~

~~~js
// Load records in useEffect without returning a Promise from the effect.
~~~

~~~js
// Submit this controlled form and disable duplicate submissions.
~~~

Accept small suggestions only. Verify every model, field, route, permission, and response against the contract.

# Time recovery plan

## If 30 minutes remain

Complete backend model, validation, create/list endpoint, and test. Then add a simple frontend service and page.

## If 15 minutes remain

Reuse an existing model and page if possible. Implement one working endpoint and show its result. Avoid optional styling and advanced abstraction.

## If 5 minutes remain

Stop adding features. Run:

~~~powershell
node --check backend/controllers/changedController.js
node --check backend/routes/changedRoutes.js
npm.cmd run build --prefix frontend
git diff --check
git status --short
~~~

Explain what works and what would be completed next.

# Final full-stack verification

Backend:

- Model/field exists.
- Validation matches the contract.
- Authentication and role middleware run.
- Ownership or profile permission is checked.
- Controller derives owner from request.user.
- Query uses correct model and fields.
- Response matches the contract.
- Errors use correct status.

Frontend:

- Service method/URL matches route.
- Request body matches validation.
- Page reads response.data.data.
- Loading, error, empty, and success states exist.
- Submit/action button disables while running.
- Route and role protection are correct.

Database:

- Expected document is created or updated.
- Unauthorized user data is not returned.
- Repeated request does not create a wrong duplicate when uniqueness matters.
- Indexes are synchronized if schema indexes changed.

Commands:

~~~powershell
node --check backend/models/ChangedModel.js
node --check backend/middleware/changedValidation.js
node --check backend/controllers/changedController.js
node --check backend/routes/changedRoutes.js
npm.cmd run build --prefix frontend
git diff --check
git status --short --branch
~~~

# Final explanation template

"I defined the API contract first. The React page calls the frontend service, which sends the agreed method and body to the Express route. Authentication, role, validation, and resource permission run before the controller. The controller derives ownership from request.user, reads or writes the Mongoose model, and returns the standard success/data response. React stores that result and handles loading, error, empty, and success states. I verified syntax, the frontend build, authorization, and database persistence."
