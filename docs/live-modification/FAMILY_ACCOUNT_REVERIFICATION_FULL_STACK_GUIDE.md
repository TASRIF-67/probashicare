# Family Account Management and Email Re-verification

## Read this first

A signed-in Family owner can change their name normally. Changing the sign-in email requires the current password, makes the account unverified, sends a one-time link to the new address, clears the session, and allows sign-in again only after verification.

### Files to open

1. backend/routes/authRoutes.js
2. backend/middleware/validateAuth.js
3. backend/controllers/authController.js
4. backend/models/User.js
5. backend/models/EmailVerificationToken.js
6. backend/utils/authTokens.js
7. backend/services/emailService.js
8. frontend/src/services/authService.js
9. frontend/src/context/AuthContext.jsx
10. frontend/src/pages/family/FamilyAccountPage.jsx
11. frontend/src/pages/auth/VerifyEmailPage.jsx

### Complete flow

~~~text
FamilyAccountPage
  -> authService.updateFamilyAccount
  -> PATCH /api/auth/account
  -> requireAuth
  -> allowRoles("family")
  -> validateFamilyAccountUpdate
  -> updateFamilyAccount
       -> select("+password")
       -> detect changed email
       -> bcrypt.compare password
       -> reject duplicate email
       -> save isVerified = false
       -> create raw token plus SHA-256 hash
       -> store hash only
       -> email raw token
       -> clear cookie
  -> clear React session and redirect
  -> VerifyEmailPage reads token
  -> GET /api/auth/verify-email
  -> hash token and find unexpired hash
  -> set isVerified = true
  -> sign in using new email
~~~

### Viva points

- Authentication and Family role run before the controller.
- Password is a bcrypt hash hidden by select: false.
- Raw verification token is never stored.
- MongoDB stores a SHA-256 hash and expiry.
- requireAuth reloads User, so an old JWT cannot bypass isVerified false.
- expiresAt is checked because TTL cleanup is asynchronous.
- Duplicate email uses a precheck plus unique index/error 11000.
- Mail failure restores old account state.
- Public responses omit password, googleId, and tokens.

## Request contracts

Name-only update:

~~~http
PATCH /api/auth/account
Cookie: session=SIGNED_JWT
Content-Type: application/json
~~~

~~~json
{
  "name": "Updated Owner",
  "email": "owner@example.com",
  "currentPassword": ""
}
~~~

It returns user, requiresEmailVerification false, and message.

Email change:

~~~json
{
  "name": "Updated Owner",
  "email": "new-owner@example.com",
  "currentPassword": "current-password"
}
~~~

It returns the new email, requiresEmailVerification true, a message, and clears the cookie.

Verification and resend:

~~~http
GET /api/auth/verify-email?token=RAW_TOKEN
POST /api/auth/resend-verification

{
  "email": "new-owner@example.com"
}
~~~

Resend and forgot-password return neutral messages to prevent account enumeration. Verification lasts 24 hours; password reset lasts one hour.

## Database design

User:

~~~js
{
  name: String,
  email: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    select: false
  },
  googleId: String,
  role: String,
  isVerified: Boolean
}
~~~

EmailVerificationToken:

~~~js
{
  userId: ObjectId,
  tokenHash: String,
  expiresAt: Date,
  usedAt: Date | null
}
~~~

The TTL index eventually cleans expired data, but the controller immediately enforces:

~~~js
{
  tokenHash,
  expiresAt: {
    $gt: new Date()
  }
}
~~~

$gt means greater than. PasswordResetToken is separate so token purposes cannot be mixed.

## Route order

~~~js
router.patch(
  "/account",
  asyncHandler(requireAuth),
  allowRoles("family"),
  validateFamilyAccountUpdate,
  asyncHandler(updateFamilyAccount),
);
~~~

1. requireAuth validates cookie and loads User.
2. allowRoles permits Family only.
3. validation normalizes input.
4. controller performs business/database logic.
5. asyncHandler forwards rejected Promises.

## Validation logic and syntax

~~~js
const name =
  String(request.body?.name || "").trim();
const email =
  normalizeEmail(request.body?.email);
const currentPassword =
  request.body?.currentPassword;
const details = {};

if (!email || !EMAIL_PATTERN.test(email)) {
  details.email = "Enter a valid email address.";
}

if (Object.keys(details).length > 0) {
  next(
    new ApiError(
      422,
      "Please correct the highlighted fields.",
      details,
    ),
  );
  return;
}
~~~

- ?. is optional chaining.
- String converts to text.
- trim removes outer spaces.
- typeof checks type.
- Object.keys returns property names.
- length gives array size.
- object spread copies properties.
- next(error) enters error middleware.
- next() continues.
- return exits the function.

## Controller logic

Load hidden password:

~~~js
const account = await User.findById(
  request.user._id,
).select("+password");
~~~

findById searches _id. select("+password") overrides select: false for this query. await pauses this async function until the Promise settles.

Snapshot and compare:

~~~js
const previousState = {
  name: account.name,
  email: account.email,
  isVerified: account.isVerified,
};

const emailChanged =
  request.body.email !== previousState.email;
~~~

Password confirmation:

~~~js
const passwordMatches = await bcrypt.compare(
  request.body.currentPassword,
  account.password,
);
~~~

bcrypt.compare reads salt and cost from the stored hash. Never use === between plain password and hash.

Duplicate lookup:

~~~js
const emailOwner = await User.findOne({
  email: request.body.email,
  _id: {
    $ne: account._id,
  },
});
~~~

$ne means not equal. The unique index protects concurrent requests.

Pause access and store safe token:

~~~js
account.email = request.body.email;
account.isVerified = false;
await account.save();

const token = createVerificationToken();

await EmailVerificationToken.deleteMany({
  userId: account._id,
});

await EmailVerificationToken.create({
  userId: account._id,
  tokenHash: token.tokenHash,
  expiresAt,
});
~~~

deleteMany invalidates old links. Only token.rawToken is emailed.

Rollback:

~~~js
try {
  await account.save();
  await issueVerificationEmail(account);
} catch (error) {
  account.name = previousState.name;
  account.email = previousState.email;
  account.isVerified = previousState.isVerified;

  await account.save();
  await EmailVerificationToken.deleteMany({
    userId: account._id,
  });

  throw error;
}
~~~

## Old-session protection

~~~js
const claims = verifySessionToken(token);
const user = await User.findById(claims.sub);

if (
  !user.isVerified &&
  (user.role === "family" ||
    user.role === "caregiver")
) {
  throw new ApiError(
    401,
    "Verify your email address before continuing.",
  );
}
~~~

The JWT signature can remain valid, but current database state denies access.

## Token generation

~~~js
const rawToken = crypto
  .randomBytes(32)
  .toString("hex");

const tokenHash = crypto
  .createHash("sha256")
  .update(rawToken)
  .digest("hex");
~~~

randomBytes gets unpredictable OS randomness. toString creates URL-safe hex. createHash selects SHA-256. update supplies input. digest returns the 64-character hash. The same raw token reproduces the lookup hash.

bcrypt is slow and salted for passwords. SHA-256 is appropriate for a random high-entropy token equality lookup.

## Frontend logic

~~~jsx
function handleChange(event) {
  const fieldName = event.target.name;
  const fieldValue = event.target.value;

  setForm(function updateForm(currentForm) {
    return {
      ...currentForm,
      [fieldName]: fieldValue,
    };
  });
}
~~~

[fieldName] uses the variable as a property name. form.email uses literal dot notation.

~~~js
const emailChanged =
  form.email.trim().toLowerCase() !== user.email;
~~~

The UI condition is convenience only; backend checks are authoritative.

~~~jsx
if (result.requiresEmailVerification) {
  clearSession();

  navigate("/login", {
    replace: true,
    state: {
      verificationNotice: result.message,
      verificationEmail: result.email,
    },
  });

  return;
}
~~~

Backend clears the cookie; clearSession clears React context.

Correct effect:

~~~jsx
useEffect(function restoreOnMount() {
  let isActive = true;

  async function load() {
    try {
      const data =
        await authService.getCurrentUser();

      if (isActive) {
        setUser(data.user);
      }
    } finally {
      if (isActive) {
        setIsLoading(false);
      }
    }
  }

  void load();

  return function stopLateUpdates() {
    isActive = false;
  };
}, []);
~~~

An effect returns cleanup, not a Promise. VerifyEmailPage shares one pending Strict Mode request and clears it after settlement so failure can retry.

## Dot notation

~~~js
const relationship =
  profile.personalInformation.familyRelationship;
~~~

This reads nested in-memory properties: profile, then personalInformation, then familyRelationship. It is not a database join.

- request.body.email means email inside body inside request.
- response.data.data means inner Axios data.
- user._id.toString() reads _id and calls its method.
- token.rawToken reads a returned property.
- searchParams.get("token") calls a method.

## MongoDB practice

~~~js
const user = await User.findById(userId);

const owner = await User.findOne({
  email: normalizedEmail,
  role: "family",
});

const privateUser = await User
  .findById(userId)
  .select("+password");

user.name = request.body.name;
await user.save();
~~~

~~~js
const updated = await User.findOneAndUpdate(
  {
    _id: userId,
    role: "family",
  },
  {
    $set: {
      name: request.body.name,
    },
  },
  {
    new: true,
    runValidators: true,
  },
);
~~~

Operators: $gt greater, $gte greater/equal, $lt less, $lte less/equal, $ne not equal, $in in array, $set replace, $unset remove, and $inc increase.

## Error matrix

| Situation | Status |
| --- | ---: |
| Invalid field | 422 |
| Wrong current password | 422 |
| Duplicate email | 409 |
| Missing/unverified session | 401 |
| Non-Family role | 403 |
| Missing Family record | 404 |
| Missing token | 422 |
| Invalid/expired token | 400 |
| Unexpected provider/database error | 500 |

## Reusable modifications

Add phone across schema, validation, controller, public response, frontend state/service, and tests:

~~~js
account.phone = request.body.phone;
await account.save();
~~~

Record email-change time:

~~~js
emailChangedAt: {
  type: Date,
  default: null,
}
~~~

~~~js
if (emailChanged) {
  account.emailChangedAt = new Date();
  account.isVerified = false;
}
~~~

Resend cooldown:

~~~js
const recentCutoff =
  new Date(Date.now() - 60 * 1000);

const recentToken =
  await EmailVerificationToken.findOne({
    userId: user._id,
    createdAt: {
      $gte: recentCutoff,
    },
  });

if (recentToken) {
  throw new ApiError(
    429,
    "Wait before requesting another link.",
  );
}
~~~

Pagination:

~~~js
const page = Math.max(
  1,
  Number(request.query.page || 1),
);
const limit = 3;
const skip = (page - 1) * limit;

const [users, total] = await Promise.all([
  User.find({
    role: "family",
  })
    .sort({
      createdAt: -1,
    })
    .skip(skip)
    .limit(limit)
    .lean(),
  User.countDocuments({
    role: "family",
  }),
]);
~~~

## Tests

~~~powershell
npm.cmd run test:auth --prefix backend
npm.cmd run test:family-account --prefix backend
~~~

Unit tests cover token hashing, normalization, invalid password type, response privacy, reset tokens, forgot-email normalization, and matching reset passwords.

The authenticated MongoDB smoke test covers login/cookie, name update, wrong password, duplicate email, email update, unverified state, hash-only token storage, old-session rejection, verification, idempotent reopening, old-email failure, new-email success, and exact fixture cleanup. It forces local console delivery, so it sends no real email.

## Moderate-to-advanced notes

- Duplicate race: two prechecks can pass; the unique index is final protection.
- MongoDB plus SMTP: a database transaction cannot undo an accepted external email. An outbox worker is a larger-system option.
- Token concurrency: verification reopening is idempotent. Password reset could later atomically claim a token.
- JWT revocation: this feature uses current isVerified. General revocation needs sessionVersion, a blacklist, or stored sessions.

## Deployment

Backend: MONGODB_URI, JWT_SECRET, CLIENT_URL, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM, and GOOGLE_CLIENT_ID when used.

Frontend: VITE_API_BASE_URL and VITE_GOOGLE_CLIENT_ID when used.

Check exact origins, credentialed CORS, Axios credentials, Secure and SameSite=None cross-origin production cookies, correct deployed links, authorized SMTP sender, and environment-only secrets.

## Common mistakes

- returning a Promise from useEffect,
- trusting frontend conditions for security,
- comparing plain password and hash with ===,
- storing raw tokens,
- relying only on TTL,
- clearing cookie but not React state,
- returning password/googleId through spread,
- ignoring unique-index races,
- leaving changed identity after delivery failure,
- revealing account existence,
- broad test cleanup,
- committing secrets.

## Viva answers

Current password proves credential knowledge, isVerified pauses access until the new address proves ownership, hash storage limits database-leak damage, TTL plus expiry query gives cleanup and immediate enforcement, select("+password") includes a normally hidden field, await pauses only the current async function, and old sessions fail because requireAuth reloads current isVerified.
