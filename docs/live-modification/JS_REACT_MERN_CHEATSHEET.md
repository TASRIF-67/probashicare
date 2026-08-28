# JavaScript, React, Express, and Mongoose Cheat Sheet

This guide covers the language and framework features used most often in ProbashiCare live modifications.

## 1. Variables

Use "const" when the variable will not be assigned a different value:

~~~js
const profileId = request.params.profileId;
~~~

Use "let" when the variable must change:

~~~js
let activeMedicationCount = 0;

for (const medication of profile.medications) {
  if (medication.isActive) {
    activeMedicationCount += 1;
  }
}
~~~

"const" does not make an object completely unchangeable. It only prevents assigning a different object to the variable.

~~~js
const user = await User.findById(userId);
user.name = "Updated Name";
await user.save();
~~~

## 2. Common value types

- string: "Dhaka"
- number: 5
- boolean: true or false
- null: deliberately no value
- undefined: a value was not supplied
- object: a group of named fields
- array: an ordered list
- Date: a date/time object
- Promise: a future async result

Check an array:

~~~js
if (!Array.isArray(request.body.items)) {
  throw new ApiError(422, "Items must be a list.");
}
~~~

Check whether a value is missing:

~~~js
if (!profile) {
  throw new ApiError(404, "Profile not found.");
}
~~~

## 3. Objects

Create an object:

~~~js
const responseBody = {
  success: true,
  data: {
    profile,
  },
};
~~~

Read a property:

~~~js
const fullName = profile.personalInformation.fullName;
~~~

Read a property whose name is stored in a variable:

~~~js
const section = request.params.section;
const items = profile[section];
~~~

Only use computed properties after checking the allowed names:

~~~js
const allowedSections = [
  "allergies",
  "medications",
];

if (!allowedSections.includes(section)) {
  throw new ApiError(404, "Section not found.");
}

profile[section] = request.body.items;
~~~

Copy an object using spread:

~~~js
const updatedPersonalInformation = {
  ...current.personalInformation,
  phone: newPhone,
};
~~~

The spread copies the existing fields. The later phone property replaces only phone.

## 4. Arrays and loops

Create an empty array:

~~~js
const profileIds = [];
~~~

Append an item with "push":

~~~js
profileIds.push(link.elderlyProfileId);
~~~

Read every item with "for...of":

~~~js
for (const profile of profiles) {
  console.log(profile.personalInformation.fullName);
}
~~~

Read by numeric position:

~~~js
for (let index = 0; index < contacts.length; index += 1) {
  const contact = contacts[index];
}
~~~

Use "map" when React must turn an array into elements:

~~~jsx
{profiles.map((profile) => (
  <ProfileCard
    key={profile._id}
    profile={profile}
  />
))}
~~~

"map" returns a new array. In React, that new array contains components.

Use "find" for the first matching item:

~~~js
const primaryContact = contacts.find((contact) => {
  return contact.isPrimary;
});
~~~

A readable loop can replace "find":

~~~js
let primaryContact = null;

for (const contact of contacts) {
  if (contact.isPrimary) {
    primaryContact = contact;
    break;
  }
}
~~~

Use "includes" to check allowed values:

~~~js
const allowedStatuses = ["active", "archived", "all"];

if (!allowedStatuses.includes(status)) {
  throw new ApiError(422, "Invalid status.");
}
~~~

Use "length" for the item count:

~~~js
const contactCount = profile.emergencyContacts.length;
~~~

## 5. Strings

Remove outside spaces:

~~~js
const cleanName = name.trim();
~~~

Ignore letter case while searching:

~~~js
const query = search.trim().toLowerCase();
const name = profileName.toLowerCase();

if (name.includes(query)) {
  // The profile matches.
}
~~~

Join ordinary text:

~~~js
const fullAddress =
  personal.address
  + ", "
  + personal.district
  + ", "
  + personal.division;
~~~

Replace characters:

~~~js
const readableStatus = status.replaceAll("-", " ");
~~~

## 6. Numbers and dates

Convert input text to a number:

~~~js
const priority = Number(event.target.value);
~~~

Round down:

~~~js
const wholeYears = Math.floor(approximateYears);
~~~

Round up for pagination:

~~~js
const pages = Math.ceil(totalItems / itemsPerPage);
~~~

Use the larger number:

~~~js
const safeAge = Math.max(0, calculatedAge);
~~~

Create a Date:

~~~js
const submittedAt = new Date();
~~~

Convert stored date text:

~~~js
const visitDate = new Date(booking.startDate);
~~~

Compare dates:

~~~js
if (startDate > endDate) {
  throw new ApiError(422, "Start date cannot be after end date.");
}
~~~

Get YYYY-MM-DD for an HTML date input:

~~~js
const maximumDate = new Date()
  .toISOString()
  .slice(0, 10);
~~~

## 7. Functions and return

A function groups reusable work:

~~~js
/**
 * Returns a readable profile name.
 * @param {object} profile - Elderly profile response.
 * @returns {string} Preferred or full name.
 * @sideEffects None.
 */
function getProfileName(profile) {
  if (profile.personalInformation.preferredName) {
    return profile.personalInformation.preferredName;
  }

  return profile.personalInformation.fullName;
}
~~~

"return" stops the function and sends a value back to its caller:

~~~js
const name = getProfileName(profile);
~~~

A bare return stops without sending a useful value:

~~~js
if (!isOwner) {
  return;
}
~~~

Every named practice-branch function should document:

- Purpose
- Parameters and types
- Exact returned value
- Side effects

## 8. Promises, async, and await

Database calls, API calls, and email calls are asynchronous.

An async function always returns a Promise:

~~~js
async function loadProfile(profileId) {
  const profile = await ElderlyProfile.findById(profileId);
  return profile;
}
~~~

"await" pauses only the current async function:

~~~js
const profile = await loadProfile(profileId);
~~~

If the Promise rejects, execution jumps to "catch":

~~~js
try {
  const data = await elderlyProfileService.getProfile(profileId);
  setProfile(data.profile);
} catch (error) {
  setError(normalizeApiError(error).message);
} finally {
  setLoading(false);
}
~~~

"finally" runs after success or failure.

## 9. ES modules

Export a named value:

~~~js
export async function getElderlyProfile(request, response) {
  // Controller work
}
~~~

Import it:

~~~js
import {
  getElderlyProfile,
} from "../controllers/elderlyProfileController.js";
~~~

Default export:

~~~js
export default router;
~~~

Default import:

~~~js
import elderlyProfileRoutes from "./routes/elderlyProfileRoutes.js";
~~~

## 10. React components

A component is a function returning JSX:

~~~jsx
/**
 * Displays one profile name.
 * @param {{profile: object}} props - Profile to display.
 * @returns {import("react").ReactElement} Profile heading.
 * @sideEffects None.
 */
function ProfileHeading({ profile }) {
  return (
    <h2>
      {profile.personalInformation.fullName}
    </h2>
  );
}
~~~

Pass props:

~~~jsx
<ProfileHeading profile={profile} />
~~~

## 11. React state

"State" is information React remembers and uses for rendering:

~~~jsx
const [loading, setLoading] = useState(true);
~~~

- loading is the current value.
- setLoading changes the value.
- Changing state schedules another render.

Object state:

~~~jsx
const [form, setForm] = useState({
  fullName: "",
  district: "",
});
~~~

Update one field safely:

~~~jsx
setForm((current) => {
  return {
    ...current,
    fullName: "Alam",
  };
});
~~~

Passing a function gives the latest state value.

## 12. React effects

Use an effect to load data after rendering:

~~~jsx
useEffect(() => {
  async function loadProfiles() {
    const data = await elderlyProfileService.listProfiles("active");
    setProfiles(data.profiles);
  }

  loadProfiles();
}, []);
~~~

Never write:

~~~jsx
useEffect(async () => {
  // Incorrect: this returns a Promise to React.
}, []);
~~~

React effects may return only:

- Nothing, or
- A cleanup function

Example cleanup:

~~~jsx
useEffect(() => {
  let active = true;

  async function loadProfiles() {
    const data = await elderlyProfileService.listProfiles();

    if (active) {
      setProfiles(data.profiles);
    }
  }

  loadProfiles();

  return function stopUpdates() {
    active = false;
  };
}, []);
~~~

## 13. Controlled forms

A controlled input reads from state and writes changes back to state:

~~~jsx
<input
  name="fullName"
  value={form.fullName}
  onChange={handleChange}
/>
~~~

Handler:

~~~js
/**
 * Stores one changed form field.
 * @param {import("react").ChangeEvent<HTMLInputElement>} event - Input change event.
 * @returns {void}
 * @sideEffects Updates React form state.
 */
function handleChange(event) {
  const fieldName = event.target.name;
  const fieldValue = event.target.value;

  setForm((current) => {
    return {
      ...current,
      [fieldName]: fieldValue,
    };
  });
}
~~~

Submit:

~~~js
async function handleSubmit(event) {
  event.preventDefault();
  setSubmitting(true);

  try {
    await elderlyProfileService.createProfile(form);
  } catch (error) {
    setError(normalizeApiError(error).message);
  } finally {
    setSubmitting(false);
  }
}
~~~

## 14. Conditional rendering

Show loading:

~~~jsx
if (loading) {
  return <p>Loading...</p>;
}
~~~

Show an error:

~~~jsx
if (error) {
  return <p>{error}</p>;
}
~~~

Show an optional button:

~~~jsx
{permission === "owner" && (
  <button type="button">
    Archive
  </button>
)}
~~~

Prefer variables and if statements instead of nested ternaries.

## 15. Frontend API service

The service keeps HTTP details out of the page:

~~~js
async function getProfile(profileId) {
  const path = "/elderly-profiles/" + profileId;
  const response = await api.get(path);
  return response.data.data;
}
~~~

The page uses it:

~~~js
const data = await elderlyProfileService.getProfile(profileId);
setProfile(data.profile);
~~~

## 16. Express routes

A route connects an HTTP method and URL to middleware/controller functions:

~~~js
router.get(
  "/:profileId",
  asyncHandler(getElderlyProfile),
);
~~~

Common methods:

- GET: read
- POST: create
- PUT: replace a complete resource or section
- PATCH: change part of a resource
- DELETE: remove a resource

## 17. Express request and response

Read route parameters:

~~~js
const profileId = request.params.profileId;
~~~

Read query parameters:

~~~js
const status = request.query.status || "active";
~~~

Read JSON body:

~~~js
const personalInformation = request.body.personalInformation;
~~~

Read authenticated user:

~~~js
const familyUserId = request.user._id;
~~~

Send JSON:

~~~js
const responseBody = {
  success: true,
  data: {
    profile,
  },
};

response.status(200);
response.json(responseBody);
~~~

## 18. Express middleware

Middleware runs before the controller:

~~~js
router.use(asyncHandler(requireAuth));
router.use(allowRoles("family"));
~~~

Validation middleware or helpers should reject bad input before database changes.

"asyncHandler" catches a rejected Promise and passes the error to the shared Express error handler.

## 19. Mongoose schemas

A schema defines document shape and validation:

~~~js
const exampleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);
~~~

Create a model:

~~~js
export const Example = mongoose.model(
  "Example",
  exampleSchema,
);
~~~

## 20. Common Mongoose operations

Create:

~~~js
const profile = await ElderlyProfile.create({
  createdBy: userId,
  personalInformation,
});
~~~

Find many:

~~~js
const profiles = await ElderlyProfile.find({
  status: "active",
});
~~~

Find one:

~~~js
const profile = await ElderlyProfile.findOne({
  _id: profileId,
});
~~~

Find by ID:

~~~js
const profile = await ElderlyProfile.findById(profileId);
~~~

Update a loaded document:

~~~js
profile.personalInformation.phone = newPhone;
await profile.save();
~~~

Delete one:

~~~js
await ElderlyProfile.deleteOne({
  _id: profileId,
});
~~~

Check existence:

~~~js
const exists = await ElderlyProfile.exists({
  _id: profileId,
  status: "active",
});
~~~

Return plain objects:

~~~js
const links = await ElderlyFamilyLink.find(filter).lean();
~~~

Use "lean" when no document method such as save is needed.

Sort newest first:

~~~js
const profiles = await ElderlyProfile.find(filter).sort({
  updatedAt: -1,
});
~~~

## 21. MongoDB query operators

Match one of several values:

~~~js
const users = await User.find({
  role: {
    $in: ["family", "caregiver"],
  },
});
~~~

Compare date or number:

~~~js
const validToken = await PasswordResetToken.findOne({
  expiresAt: {
    $gt: new Date(),
  },
});
~~~

Regular expression:

~~~js
await User.deleteMany({
  email: {
    $regex: "^smoke-",
  },
});
~~~

## 22. References and populate

A schema reference:

~~~js
elderlyProfileId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "ElderlyProfile",
  required: true,
}
~~~

Populate replaces an ID with selected referenced document fields:

~~~js
const links = await ElderlyFamilyLink.find({
  familyUserId,
}).populate(
  "elderlyProfileId",
  "personalInformation status",
);
~~~

Only populate fields needed by the response.

## 23. Transactions

Use a transaction when multiple writes must all succeed together:

~~~js
const session = await mongoose.startSession();

try {
  await session.withTransaction(async () => {
    const profiles = await ElderlyProfile.create(
      [profileData],
      {
        session,
      },
    );

    await ElderlyFamilyLink.create(
      [
        {
          elderlyProfileId: profiles[0]._id,
          familyUserId,
        },
      ],
      {
        session,
      },
    );
  });
} finally {
  await session.endSession();
}
~~~

Creating a profile without its owner link would make the profile unusable, so these writes belong in one transaction.

## 24. Standard errors

Operational error:

~~~js
throw new ApiError(
  404,
  "Elderly profile not found.",
);
~~~

Validation details:

~~~js
throw new ApiError(
  422,
  "Please correct the profile.",
  {
    "personalInformation.fullName": "Full name is required.",
  },
);
~~~

Concealed 404:

Return the same 404 for:

- Invalid ID
- Missing profile
- Missing access link
- Wrong permission

This prevents an unauthorized user from learning that a private health record exists.

## 25. HTTP status reminder

- 200: normal successful read/update
- 201: resource created
- 400: invalid action or token
- 401: not signed in
- 403: signed in but role/action forbidden
- 404: resource missing or concealed
- 409: conflict or duplicate
- 422: validation failure
- 500: unexpected backend failure

## 26. Debugging sequence

When a page fails:

1. Read the browser console.
2. Open Network and inspect request URL, method, payload, status, and response.
3. Confirm the frontend service path.
4. Confirm the Express route exists.
5. Confirm authentication and role middleware.
6. Add a temporary backend log near the controller input.
7. Confirm the query filter uses the correct IDs and statuses.
8. Inspect the MongoDB document.
9. Remove temporary logs after fixing.
10. Run build and tests.

## 27. Commands worth memorizing

~~~powershell
git status --short --branch
rg -n "searchText" backend frontend/src
node --check backend/controllers/exampleController.js
npm.cmd test --prefix backend
npm.cmd run build --prefix frontend
git diff --check
git diff --stat
~~~