# Elderly Health Profile Management: Full-Stack Study Guide

## 1. Functional requirement

Family members can create and manage elderly profiles containing:

- Personal information
- Medical history
- Allergies
- Medications
- Chronic diseases
- Emergency contacts

The implementation must also protect private health information. A family user can read or edit a profile only through an active ElderlyFamilyLink with the required permission.

## 2. Architecture summary

~~~text
React page
  -> elderlyProfileService
    -> Express elderlyProfileRoutes
      -> requireAuth
      -> allowRoles("family")
        -> elderlyProfileController
          -> validateElderlyProfilePayload
          -> elderlyProfileAccessService
            -> ElderlyFamilyLink query
            -> ElderlyProfile query
              -> MongoDB
~~~

The response travels back through the same layers:

~~~text
MongoDB document
  -> controller response object
    -> JSON HTTP response
      -> frontend service
        -> React state
          -> rendered page
~~~

## 3. Why there are two models

### ElderlyProfile

Stores the actual personal and health record.

Important fields:

- createdBy
- personalInformation
- medicalHistory
- allergies
- medications
- chronicDiseases
- emergencyContacts
- status
- archivedAt
- createdAt and updatedAt

The health arrays are embedded because they belong directly to one profile and are edited together with that record.

### ElderlyFamilyLink

Stores authorization between a family user and an elderly profile.

Important fields:

- elderlyProfileId
- familyUserId
- relationship
- permission
- linkedBy
- status
- createdAt and updatedAt

Permissions:

- owner: view, edit, and archive
- editor: view and edit
- viewer: view only

A compound unique index prevents the same family user from receiving duplicate link documents for the same profile.

## 4. Why access is not based only on createdBy

The original creator is not always the only authorized family member. A separate link model supports sharing and explicit permissions.

Unsafe check:

~~~js
if (profile.createdBy.toString() === request.user._id.toString()) {
  // This excludes legitimate editors and viewers.
}
~~~

Correct approach:

~~~js
const { profile, link } = await getAuthorizedElderlyProfile({
  profileId,
  familyUserId: request.user._id,
  permissions: ["owner", "editor", "viewer"],
});
~~~

## 5. Backend endpoints

### Create profile

~~~text
POST /api/elderly-profiles
Role: family
~~~

Request:

~~~json
{
  "personalInformation": {
    "fullName": "Alam Hossain",
    "preferredName": "Alam",
    "dateOfBirth": "1955-04-10",
    "gender": "male",
    "bloodGroup": "O+",
    "phone": "+8801700000000",
    "address": "Dhanmondi",
    "district": "Dhaka",
    "division": "Dhaka",
    "preferredLanguage": "Bangla",
    "familyRelationship": "Son",
    "careNotes": "Prefers morning visits"
  },
  "medicalHistory": [],
  "allergies": [],
  "medications": [],
  "chronicDiseases": [],
  "emergencyContacts": []
}
~~~

Success:

~~~json
{
  "success": true,
  "data": {
    "profile": {
      "_id": "...",
      "personalInformation": {},
      "familyAccess": {
        "relationship": "Son",
        "permission": "owner"
      }
    }
  }
}
~~~

Database behavior:

1. Validate the complete request.
2. Start a MongoDB session.
3. Start a transaction.
4. Create ElderlyProfile.
5. Create owner ElderlyFamilyLink.
6. Commit both writes.
7. End the session.
8. Return HTTP 201.

Why transaction matters:

- A profile without its owner link cannot be accessed normally.
- A link without its profile points to missing data.
- The transaction makes both writes succeed or both roll back.

### List profiles

~~~text
GET /api/elderly-profiles?status=active
Role: family
~~~

Allowed status values:

- active
- archived
- all

Database behavior:

1. Find active ElderlyFamilyLink documents for the signed-in family.
2. Collect linked profile IDs.
3. Query ElderlyProfile using "_id: { $in: linkedProfileIds }".
4. Apply the requested profile status unless status is all.
5. Sort by updatedAt descending.
6. Attach the current caller's permission and relationship.
7. Return profiles and count.

The link query is the authorization boundary. Never query every profile first and filter private data in the frontend.

### Get one profile

~~~text
GET /api/elderly-profiles/:profileId
Role: family
Permission: owner, editor, or viewer
~~~

The access service:

1. Validates ObjectId format.
2. Looks for an active authorized link.
3. Looks for the active profile.
4. Returns both documents.
5. Uses the same 404 for invalid, missing, and unauthorized records.

### Replace complete profile

~~~text
PUT /api/elderly-profiles/:profileId
Role: family
Permission: owner or editor
~~~

Behavior:

1. Validate complete personal information and arrays.
2. Authorize owner/editor link.
3. Replace personalInformation.
4. Replace every editable health/contact array.
5. Save the profile.
6. If the caller is the owner, synchronize the link relationship.
7. Return the updated profile.

### Replace personal information

~~~text
PATCH /api/elderly-profiles/:profileId/personal-information
Role: family
Permission: owner or editor
~~~

Body:

~~~json
{
  "personalInformation": {
    "fullName": "Alam Hossain"
  }
}
~~~

The real request must contain the complete required personal-information section, not only fullName.

### Replace one profile section

~~~text
PUT /api/elderly-profiles/:profileId/:section
Role: family
Permission: owner or editor
~~~

Allowed sections:

- medicalHistory
- allergies
- medications
- chronicDiseases
- emergencyContacts

Body:

~~~json
{
  "items": [
    {
      "allergen": "Penicillin",
      "type": "medicine",
      "reaction": "Rash",
      "severity": "severe"
    }
  ]
}
~~~

The controller checks the section against an allowlist before using "profile[section]". This prevents arbitrary field updates.

### Archive profile

~~~text
PATCH /api/elderly-profiles/:profileId/archive
Role: family
Permission: owner
~~~

The record is not deleted. The controller sets:

~~~js
profile.status = "archived";
profile.archivedAt = new Date();
await profile.save();
~~~

Archiving preserves health history and removes the record from active workflows.

## 6. Validation rules

Personal information validates:

- Full name required
- Date of birth required
- Date of birth not in the future
- Gender required
- Address required
- District required
- Division required
- Family relationship required
- Phone format when supplied

All embedded sections:

- Must be arrays
- Maximum 50 items per section

Emergency contacts:

- Only one primary contact
- Phone numbers must be unique after formatting characters are removed
- Name required
- Relationship required
- Valid phone required

Medications:

- Name required
- End date cannot be before start date

Mongoose still performs schema validation after request validation. Request validation provides friendlier field-specific errors; schema validation protects the database.

## 7. Error behavior

### 401

No valid session.

Handled by requireAuth before the controller.

### 403

Signed-in user has the wrong role.

Handled by allowRoles("family").

### 404

Profile ID invalid, profile missing, profile archived, access link missing, or permission insufficient.

The concealed response prevents record-existence disclosure.

### 422

Request validation fails.

Example:

~~~json
{
  "success": false,
  "error": {
    "message": "Please correct the elderly profile information.",
    "details": {
      "personalInformation.fullName": "Full name is required."
    }
  }
}
~~~

### 500

Unexpected database or server failure.

The shared error handler logs the internal error and returns a safe generic response.

## 8. Frontend routes and components

### Routes

- /elderly-profiles
- /elderly-profiles/new
- /elderly-profiles/:profileId
- /elderly-profiles/:profileId/edit

### List page

ElderlyProfileListPage:

1. Stores profiles, loading, error, selected view, search, and page.
2. Calls listProfiles when the selected view changes.
3. Filters already-authorized results in the browser.
4. Calculates three-profile pagination.
5. Displays summary counts and profile cards.

### Create page

CreateElderlyProfilePage:

1. Displays ProfileForm with empty data.
2. Calls createProfile.
3. Refreshes the authenticated user so onboarding status updates.
4. Shows a success toast.
5. Navigates to the new profile.

### Edit page

EditElderlyProfilePage:

1. Reads profileId from the URL.
2. Loads the profile in useEffect.
3. Passes it to ProfileForm.
4. Calls updateProfile on final submit.
5. Navigates back to details.

### Detail page

ElderlyProfileDetailPage:

1. Reads profileId.
2. Loads the authorized profile.
3. Displays health summary cards.
4. Displays tabbed embedded records.
5. Shows Archive only to owners.
6. Calls archiveProfile after confirmation.

### ProfileForm

ProfileForm is shared by create and edit.

It stores one object:

~~~js
{
  personalInformation: {},
  medicalHistory: [],
  allergies: [],
  medications: [],
  chronicDiseases: [],
  emergencyContacts: []
}
~~~

Steps:

1. Personal
2. Health
3. Emergency
4. Review

RepeatedSection handles add, update, remove, and primary-contact selection for embedded arrays.

## 9. Frontend service contract

Every service method returns only "response.data.data".

Example:

~~~js
async function getProfile(profileId) {
  const response = await api.get(
    "/elderly-profiles/" + profileId,
  );

  return response.data.data;
}
~~~

The page therefore receives:

~~~js
const data = await elderlyProfileService.getProfile(profileId);
setProfile(data.profile);
~~~

Do not accidentally write:

~~~js
setProfile(data);
~~~

because data contains a "profile" property.

## 10. Complete create flow

~~~text
Family clicks Create profile
  -> CreateElderlyProfilePage renders ProfileForm
  -> User fills controlled inputs
  -> ProfileForm calls onSubmit(value)
  -> handleCreate(value)
  -> elderlyProfileService.createProfile(value)
  -> Axios POST /elderly-profiles
  -> requireAuth reads session cookie
  -> allowRoles checks family
  -> createElderlyProfile validates payload
  -> MongoDB transaction creates profile and owner link
  -> Controller returns 201 JSON
  -> Service returns response.data.data
  -> Page refreshes auth
  -> Page shows toast
  -> Page navigates to profile details
~~~

## 11. Complete list flow

~~~text
List page renders
  -> useEffect runs
  -> listProfiles(selectedView)
  -> GET /elderly-profiles?status=active
  -> route authentication
  -> list controller
  -> link query finds authorized IDs
  -> profile query returns matching profiles
  -> controller adds familyAccess
  -> page stores profiles
  -> React maps profiles into cards
~~~

## 12. Practice database operations

Inspect active profiles:

~~~javascript
db.elderlyprofiles.find({
  status: "active"
})
~~~

Inspect links for a family user:

~~~javascript
db.elderlyfamilylinks.find({
  familyUserId: ObjectId("FAMILY_USER_ID"),
  status: "active"
})
~~~

Find one profile and its links:

~~~javascript
db.elderlyprofiles.findOne({
  _id: ObjectId("PROFILE_ID")
})

db.elderlyfamilylinks.find({
  elderlyProfileId: ObjectId("PROFILE_ID")
})
~~~

Archive manually only in the practice database:

~~~javascript
db.elderlyprofiles.updateOne(
  {
    _id: ObjectId("PROFILE_ID")
  },
  {
    $set: {
      status: "archived",
      archivedAt: new Date()
    }
  }
)
~~~

## 13. Example live modification

### Teacher requirement

"On the elderly profile details page, show how many active family members have access to this profile. The count must come from the link collection."

This is useful because the page currently displays ElderlyProfile data, but the new value must come from ElderlyFamilyLink.

### Step 1: Identify files

Backend:

- backend/controllers/elderlyProfileController.js
- backend/models/ElderlyFamilyLink.js

Frontend:

- frontend/src/pages/elderly/ElderlyProfileDetailPage.jsx

The existing endpoint can be extended, so no new route or service method is required.

### Step 2: Write the query on paper

~~~js
const linkedFamilyCount = await ElderlyFamilyLink.countDocuments({
  elderlyProfileId: profile._id,
  status: "active",
});
~~~

"countDocuments" asks MongoDB for a count without loading complete link documents.

### Step 3: Add query after authorization

Inside getElderlyProfile, after getAuthorizedElderlyProfile succeeds:

~~~js
const linkedFamilyCount = await ElderlyFamilyLink.countDocuments({
  elderlyProfileId: profile._id,
  status: "active",
});
~~~

Authorization must happen first. Otherwise an unauthorized user could use the endpoint to discover whether links exist.

### Step 4: Add response field

~~~js
const profileResponse = toProfileResponse(
  profile,
  link,
);

profileResponse.linkedFamilyCount = linkedFamilyCount;

const responseBody = {
  success: true,
  data: {
    profile: profileResponse,
  },
};

response.json(responseBody);
~~~

Expected response addition:

~~~json
{
  "profile": {
    "_id": "...",
    "linkedFamilyCount": 2
  }
}
~~~

### Step 5: Display it in React

In ElderlyProfileDetailPage, add another summary card or detail:

~~~jsx
<Card className="snapshot-card">
  <span className="snapshot-card__icon">
    <UsersIcon />
  </span>

  <div>
    <strong>{profile.linkedFamilyCount || 0}</strong>
    <span>Authorized family members</span>
    <small>Active profile links</small>
  </div>
</Card>
~~~

### Step 6: Error and permission behavior

No new public error is required:

- Unauthorized users still receive concealed 404.
- Database errors reach the shared 500 handler.
- Only active links are counted.
- Revoked links are excluded.

### Step 7: Manual test

1. Sign in as the owner family.
2. Open a profile.
3. Confirm the count is at least one.
4. Add another active link in the practice database.
5. Refresh and confirm the count increases.
6. Set the second link status to revoked.
7. Refresh and confirm the count decreases.
8. Sign in as an unrelated family and confirm 404 remains.

### Step 8: Explain it in the viva

"I reused the existing authorized GET endpoint. After the access service confirmed the caller could view the profile, I used countDocuments on ElderlyFamilyLink with the profile ID and active status. I added the count to the existing profile response and rendered it in React. Authorization remains before the new query, so the change does not expose private relationship information."

## 14. Common teacher variations

### Add a new personal field

Likely files:

- ElderlyProfile schema
- validateElderlyProfile when required
- ProfileForm initial value and input
- Detail page display

### Show only severe allergies

Frontend-only version:

- Filter the already-loaded allergy array.

Backend version:

- Create a focused endpoint only if the teacher requires server-side querying.

### Search by district

Current implementation is frontend filtering. For server-side search:

1. Add a query parameter.
2. Validate its length.
3. Add a safely escaped search filter.
4. Preserve linked-profile ID authorization.
5. Pass the query from the frontend service.

### Add another embedded section

Likely changes:

1. Add embedded schema and profile field.
2. Add section name to controller allowlist.
3. Add validation rules.
4. Add form state and fields.
5. Add service call if focused saving is required.
6. Add detail tab and renderer.
7. Update smoke test.

### Display related data from another collection

Pattern:

1. Authorize the primary profile.
2. Query the related collection using profile._id.
3. Select only required fields.
4. Add a clear response property.
5. Render loading/empty/data states.
6. Confirm unrelated users cannot obtain the related data.

## 15. Viva questions and short answers

### Why use ElderlyFamilyLink?

It represents many-to-many family access with explicit owner, editor, and viewer permissions.

### Why use a transaction during creation?

The profile and owner link must both exist. A transaction prevents partial creation.

### Why return 404 for unauthorized access?

It conceals whether a private health record exists.

### Why archive instead of delete?

Health history may be needed later, and deletion would permanently remove medical context.

### Why keep medical arrays embedded?

They are bounded reference information belonging directly to one profile and are usually loaded with that profile.

### Why not store wellness reports inside ElderlyProfile?

Wellness reports are time-series transactional data that can grow indefinitely and need separate queries.

### What does lean do?

It returns plain objects instead of full Mongoose documents when save and other document methods are unnecessary.

### What does asyncHandler do?

It catches rejected async controller Promises and forwards errors to the shared Express error middleware.

### What protects the routes?

A valid session, family-role middleware, link-based authorization, permission checks, request validation, and Mongoose schema validation.

### How is the frontend connected?

React page calls elderlyProfileService, which uses the shared Axios instance to call the Express route and returns response.data.data.

## 16. Verification checklist

~~~powershell
node --check backend/models/ElderlyProfile.js
node --check backend/models/ElderlyFamilyLink.js
node --check backend/controllers/elderlyProfileController.js
node --check backend/routes/elderlyProfileRoutes.js
node --check backend/middleware/validateElderlyProfile.js
node --check backend/services/elderlyProfileAccessService.js
node --check backend/scripts/smokeElderlyProfiles.js
npm.cmd run build --prefix frontend
git diff --check
git status --short --branch
~~~

Run the MongoDB smoke test only against a confirmed test-safe database and with the local backend running.