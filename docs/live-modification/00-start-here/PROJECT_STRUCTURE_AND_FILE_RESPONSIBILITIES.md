# ProbashiCare Project Structure and File Responsibilities

Use this guide when you understand the requirement but do not know which file or folder should contain the change.

For a completely unclear full-stack requirement, first use [WORST_CASE_FULL_STACK_CHECKLIST.md](WORST_CASE_FULL_STACK_CHECKLIST.md). Return here whenever you need to decide where a piece of code belongs.

# 1. Complete request flow

Most authenticated features follow this path:

~~~text
Browser route
  -> React page
  -> child component
  -> frontend service
  -> Axios shared API client
  -> Express app route prefix
  -> feature route
  -> authentication middleware
  -> role/entitlement middleware
  -> validation middleware
  -> controller
  -> backend service, when needed
  -> Mongoose model
  -> MongoDB
  -> controller JSON response
  -> frontend service response.data.data
  -> React state
  -> rendered UI
~~~

When debugging, test one arrow at a time.

# 2. Quick decision table

| Code you need to write | Correct location |
| --- | --- |
| MongoDB fields, references, defaults, enums, indexes | backend/models |
| HTTP method and endpoint path | backend/routes |
| Check login or role | backend/middleware/auth.js |
| Check Premium entitlement | backend/middleware/requireFamilyEntitlement.js |
| Validate body, query, or route ID | backend/middleware/validateFeature.js |
| Read request and send response | backend/controllers |
| Reusable business rule or several database writes | backend/services |
| External provider call | backend/services |
| Small pure calculation or shared error helper | backend/utils |
| Mount a completely new route group | backend/app.js |
| Connect database and start server | backend/server.js |
| Database synchronization/migration/smoke flow | backend/scripts |
| Focused unit test | backend/test |
| Browser URL and role-protected screen | frontend/src/App.jsx |
| Full route-level screen | frontend/src/pages |
| Reusable visual or form section | frontend/src/components |
| Axios request to backend | frontend/src/services |
| Shared user/session/notification/subscription state | frontend/src/context |
| Reusable React behavior | frontend/src/hooks |
| Small formatting or navigation helper | frontend/src/utils |
| Feature or global presentation | frontend/src/styles |
| Mount providers and global styles | frontend/src/main.jsx |

# 3. Actual top-level backend structure

~~~text
backend/
├── app.js
├── server.js
├── config/
├── models/
├── middleware/
├── routes/
├── controllers/
├── services/
├── utils/
├── scripts/
└── test/
~~~

Do not edit backend/node_modules. Do not commit backend/.env.

# 4. backend/server.js

Current responsibility:

~~~text
validate environment
  -> connect MongoDB
  -> start Express listener on configured port
~~~

Change server.js only when the server startup lifecycle itself changes.

Do not add:

- Feature endpoints.
- Controller logic.
- Mongoose queries.
- Frontend configuration.
- Normal feature-specific background work without a clear startup requirement.

If an endpoint is missing, server.js is almost never the correct file.

# 5. backend/app.js

Current responsibilities:

- Creates the Express app.
- Applies Helmet and CORS.
- Handles raw Stripe webhook bytes before JSON parsing.
- Applies JSON and cookie parsing.
- Provides the health endpoint.
- Mounts feature route groups.
- Applies final not-found and error middleware.

Example composition:

~~~js
app.use(
  "/api/elderly-profiles",
  elderlyProfileRoutes,
);
~~~

If elderlyProfileRoutes contains:

~~~js
router.get(
  "/:profileId",
  asyncHandler(getProfile),
);
~~~

The complete URL is:

~~~text
GET /api/elderly-profiles/:profileId
~~~

Change app.js when:

- Adding a completely new route group.
- Adding global middleware.
- Adding provider middleware that requires special order.
- Changing CORS or global request parsing intentionally.

Do not change app.js when adding another endpoint to an existing route group. Add that endpoint to the existing route file.

Important ordering:

~~~text
Stripe raw webhook
  -> express.json
  -> feature routes
  -> notFound
  -> errorHandler
~~~

# 6. backend/config

Actual examples:

~~~text
config/database.js
config/env.js
config/cloudinary.js
config/subscriptionPlans.js
config/wellnessAlertRules.js
~~~

Use config for:

- Environment parsing and validation.
- Database connection.
- Provider client configuration.
- Backend-authoritative plan/rule definitions.

Do not put controller request/response code here.

Example decision:

~~~text
New subscription price definition
  -> config/subscriptionPlans.js

New request body validation
  -> middleware, not config

New calculated payment completion logic
  -> service, not config
~~~

# 7. backend/models

Models define MongoDB persistence.

Actual feature examples:

~~~text
ElderlyProfile.js
ElderlyFamilyLink.js
WellnessReport.js
WellnessInsight.js
WellnessAlert.js
Notification.js
FamilySubscription.js
SubscriptionPlan.js
SubscriptionPayment.js
User.js
EmailVerificationToken.js
PasswordResetToken.js
~~~

A model contains:

- Field types.
- Required/default values.
- Enums.
- Embedded schemas.
- References.
- Indexes.
- Model-level methods/hooks when appropriate.

A model should not contain:

- Express request or response.
- React code.
- Route paths.
- UI messages.
- Provider HTTP calls.

Use embedding when the data belongs only to one parent, such as medications inside ElderlyProfile.

Use a separate referenced model when the data needs independent:

- History.
- Status transitions.
- Pagination.
- Permissions.
- Unique indexes.
- Concurrent updates.

After changing indexes, run the repository index synchronization command.

# 8. backend/routes: endpoint map

Routes are important because they define the public API surface.

Actual route files include:

~~~text
authRoutes.js
elderlyProfileRoutes.js
notificationRoutes.js
subscriptionRoutes.js
stripeWebhookRoutes.js
wellnessInsightRoutes.js
wellnessReportRoutes.js
adminUserRoutes.js
bookingRoutes.js
careVisitRoutes.js
caregiverRoutes.js
~~~

A route should answer four questions:

~~~text
Which HTTP method?
Which URL?
Which middleware?
Which controller?
~~~

Correct shape:

~~~js
router.patch(
  "/:notificationId/read",
  validateObjectIdParameter(
    "notificationId",
  ),
  asyncHandler(markNotificationRead),
);
~~~

A route should not contain:

- Long database queries.
- Transactions.
- Provider calls.
- Large response-building logic.
- React navigation.

Recommended middleware order:

~~~text
requireAuth
  -> allowRoles
  -> require entitlement, if relevant
  -> validate params/query/body
  -> controller
~~~

Route-order rule:

~~~text
/read-all
/:notificationId/read
/:notificationId
~~~

Place fixed paths before dynamic parameter paths when they could otherwise match the same text.

Use GET for reading, POST for creating/actions, PATCH for partial updates/status actions, PUT for complete replacements, and DELETE only when actual removal is intended.

# 9. backend/middleware

Actual middleware categories:

~~~text
auth.js
requireFamilyEntitlement.js
validateAuth.js
validateElderlyProfile.js
validateSubscription.js
validateWellnessAlert.js
validateWellnessReport.js
errorHandler.js
~~~

Middleware runs before the controller.

Use it for:

- Session authentication.
- Role checks.
- Premium entitlement.
- ObjectId validation.
- Query/body validation.
- File upload parsing.
- Standard error conversion.

Authentication and authorization differ:

~~~text
Authentication:
Who is the current user?

Role authorization:
Is this user a Family, Caregiver, or Admin?

Resource authorization:
Does this specific user own or have permission for this record?
~~~

Role middleware belongs in middleware. Detailed elderly-profile resource permission often belongs in elderlyProfileAccessService because controllers and services reuse it.

# 10. backend/controllers

Controllers are the HTTP coordination layer.

Actual examples:

~~~text
authController.js
elderlyProfileController.js
notificationController.js
subscriptionController.js
adminSubscriptionController.js
wellnessInsightController.js
wellnessReportController.js
stripeWebhookController.js
~~~

A controller normally:

1. Reads request.user.
2. Reads request.params, request.query, or request.body.
3. Performs or calls permission checks.
4. Calls a Mongoose model or backend service.
5. Builds the API response.
6. Throws ApiError for expected failures.

Controller shape:

~~~js
/**
 * Returns caller-authorized records.
 * @param {import("express").Request} request - Authenticated request.
 * @param {import("express").Response} response - Express response.
 * @returns {Promise<void>} Resolves after sending the response.
 * @sideEffects Reads MongoDB.
 */
export async function listRecords(
  request,
  response,
) {
  const records =
    await Example.find({
      familyUserId: request.user._id,
    }).lean();

  response.json({
    success: true,
    data: {
      records,
    },
  });
}
~~~

A controller may contain a simple one-query operation. Move logic to a service when it becomes reusable, provider-dependent, transactional, or difficult to explain inside the controller.

# 11. backend/services

Backend services contain reusable business operations.

Actual services include:

~~~text
elderlyProfileAccessService.js
notificationService.js
geminiWellnessService.js
wellnessAnalysisService.js
wellnessInsightService.js
entitlementService.js
subscriptionService.js
prototypePaymentService.js
stripePaymentService.js
subscriptionReminderService.js
emailService.js
googleAuthService.js
googleCalendarService.js
cloudinaryService.js
~~~

Use a backend service when logic:

- Is used by several controllers.
- Performs several related database operations.
- Requires a transaction.
- Calls Gemini, Stripe, SMTP, Google, Cloudinary, or another provider.
- Implements an important business rule.
- Needs an independent unit test.
- Creates notifications from multiple workflows.

Controller versus service:

~~~text
Controller:
request, response, status code, route inputs

Service:
business input, permission result, provider call,
database transaction, calculated output
~~~

A service should generally not navigate React or render JSX.

# 12. backend/utils

Actual examples:

~~~text
ApiError.js
asyncHandler.js
authTokens.js
subscriptionPeriod.js
subscriptionConstants.js
bookingSchedule.js
userResponse.js
~~~

Use utils for small reusable operations that are mostly independent:

- Error class.
- Async controller wrapper.
- Hash/token helpers.
- Date calculations.
- Constants.
- Response privacy projection.
- Booking schedule calculation.

Do not create a utility only to avoid writing three readable lines once.

Difference:

~~~text
Utility:
small and mostly context-free

Service:
understands a business workflow or external system
~~~

# 13. backend/scripts and backend/test

Scripts are executable workflows:

~~~text
smokeElderlyProfiles.js
smokeNotifications.js
smokeSubscriptions.js
syncIndexes.js
migrations
provider delivery checks
~~~

Use scripts for:

- Authenticated MongoDB smoke tests.
- Index synchronization.
- Plan synchronization.
- Legacy-data migration.
- One-time operational checks.

Use backend/test for focused Node tests of:

- Validation helpers.
- Date calculations.
- Sanitization.
- Fallback behavior.
- Controller behavior with mocked dependencies.

A smoke script may write MongoDB. It must mark its fixtures and clean only those fixtures.

# 14. Actual frontend structure

~~~text
frontend/src/
├── main.jsx
├── App.jsx
├── pages/
├── components/
├── services/
├── context/
├── hooks/
├── utils/
└── styles/
~~~

# 15. frontend/src/main.jsx

Current responsibility:

- Creates the React root.
- Adds BrowserRouter.
- Adds GoogleOAuthProvider.
- Adds Theme, Toast, Auth, Subscription, and Notification providers.
- Imports global styles.
- Renders App.

Change main.jsx when adding a genuinely global provider or global stylesheet.

Do not add:

- A feature form.
- Page-specific API loading.
- Feature routes.
- MongoDB logic.

Provider order matters because inner providers can consume outer contexts.

# 16. frontend/src/App.jsx

App.jsx defines browser routes and role protection.

Current route groups include:

~~~text
public:
  /
  /login
  /signup
  /verify-email

Family:
  /dashboard
  /elderly-profiles
  /wellness
  /subscription
  /notifications

Admin:
  /admin
  /admin/payments
  /admin/bookings

Caregiver:
  /caregiver/dashboard
  /caregiver/bookings
  /caregiver/wellness-reports
  /caregiver/notifications
~~~

Change App.jsx when:

- Adding a new route-level page.
- Changing role protection intentionally.
- Adding a compatibility redirect.

Do not change App.jsx when:

- Adding a child component inside an existing page.
- Adding an API endpoint.
- Adding a model field.
- Styling an existing page.

Use the existing ProtectedRoute prop name and nesting pattern. Do not invent a second protection system.

# 17. frontend/src/pages

Pages are complete route-level screens.

Examples:

~~~text
family/FamilyAccountPage.jsx
family/FamilySubscriptionPage.jsx
elderly/ElderlyProfileListPage.jsx
elderly/ElderlyWellnessPage.jsx
caregiver/WellnessReportEditorPage.jsx
admin/AdminSubscriptionPaymentsPage.jsx
NotificationsPage.jsx
~~~

A page usually:

- Reads route parameters.
- Owns page-level loading and error state.
- Calls frontend services or shared context.
- Composes components.
- Handles navigation after success.

Create a new page when the feature deserves its own URL and full screen.

Do not create a page for a small reusable card, button, modal, or form section.

# 18. frontend/src/components

Components are reusable or meaningful UI sections.

Actual categories:

~~~text
components/elderly
components/wellness
components/notifications
components/subscription
components/admin
components/booking
components/grocery
components/dashboard
~~~

Examples:

~~~text
elderly/ProfileForm.jsx
wellness/WellnessInsightsPanel.jsx
notifications/NotificationBell.jsx
subscription/CurrentSubscriptionCard.jsx
subscription/PremiumFeatureGate.jsx
admin/AdminBusinessAnalytics.jsx
Pagination.jsx
Modal.jsx
Button.jsx
Input.jsx
~~~

Create a component when:

- The UI is reused.
- A page section is large enough to understand separately.
- It needs its own props and handlers.
- It is a controlled modal or form.
- It represents one feature card/panel.

Keep state in the nearest common owner. Do not move all state to context simply because two nested components need it; pass props when scope is local.

# 19. frontend/src/services

Frontend services are Axios request wrappers.

Actual feature services:

~~~text
api.js
authService.js
elderlyProfileService.js
notificationService.js
subscriptionService.js
wellnessInsightService.js
wellnessAlertService.js
wellnessReportService.js
adminService.js
~~~

A frontend service knows:

- Backend path.
- HTTP method.
- Query parameters.
- Request body.
- Response extraction.

Example:

~~~js
/**
 * Creates a caller-authorized record.
 * @param {object} payload - Validated form values.
 * @returns {Promise<{record: object}>} Created record wrapper.
 * @sideEffects Sends an authenticated API request.
 */
async function createRecord(payload) {
  const response = await api.post(
    "/examples",
    payload,
  );

  return response.data.data;
}
~~~

A frontend service should not:

- Render JSX.
- Call React hooks.
- Directly change component state.
- Contain MongoDB queries.
- Decide backend authorization.

api.js owns shared Axios configuration and normalizeApiError. Feature services should import it rather than create another Axios client.

# 20. frontend/src/context

Current contexts:

~~~text
AuthContext.jsx
NotificationContext.jsx
SubscriptionContext.jsx
ThemeContext.jsx
ToastContext.jsx
~~~

Use context when state is needed across distant pages/components:

- Current authenticated user.
- Notification unread count.
- Effective subscription access.
- Theme.
- Global toasts.

A context normally contains:

- Provider.
- Shared state.
- Shared actions.
- Optional polling/effect cleanup.
- Memoized value.
- Custom useContext hook.

Do not use context for one page's input field or modal state.

# 21. frontend/src/hooks

Current example:

~~~text
useAuthRedirect.js
~~~

A custom hook contains reusable React behavior involving hooks.

Use a hook when several components need the same state/effect/navigation behavior.

Do not place normal non-React formatting logic in a hook. Put it in utils.

# 22. frontend/src/utils

Current examples:

~~~text
motion.js
notificationHelpers.js
~~~

Use frontend utils for small reusable operations:

- Safe notification destination.
- Formatting.
- Motion preference helpers.
- Pure data transformations.

Utils should not render full pages or directly query MongoDB.

# 23. frontend/src/styles

Styles include global, feature, navigation, dashboard, notification, grocery, and doctor-appointment CSS.

Use:

- global.css for shared tokens and truly global rules.
- Feature stylesheet for feature-specific classes.
- Existing variables for light/dark consistency.

Do not solve missing API data with CSS. Do not add inline style objects everywhere when the project already uses named classes.

# 24. Page versus component versus context decision

| Situation | Use |
| --- | --- |
| Needs its own browser URL | Page |
| Reusable card/form/modal/panel | Component |
| Used only inside one page | Component or keep in page if small |
| Shared across distant routes | Context |
| Reusable hook-based behavior | Hook |
| API request wrapper | Frontend service |
| Pure formatting/path helper | Utility |

# 25. Controller versus backend service decision

| Situation | Use |
| --- | --- |
| One simple authorized query and response | Controller can handle it |
| Several controllers need the operation | Service |
| Transaction across models | Service |
| Gemini/Stripe/SMTP/Google call | Service |
| Complex calculation or orchestration | Service |
| Read request and send HTTP response | Controller |
| Validate incoming fields before controller | Middleware |
| Small pure calculation | Utility |

# 26. When integration files should change

| File | Change only when |
| --- | --- |
| backend/app.js | Mounting a new route group or global middleware |
| backend/server.js | Startup/database/listener lifecycle changes |
| frontend/src/main.jsx | Adding a global provider or stylesheet |
| frontend/src/App.jsx | Adding/changing a browser route or role gate |
| frontend/src/styles/global.css | Adding truly shared tokens/rules |
| backend/package.json | A required backend dependency/script changes |
| frontend/package.json | A required frontend dependency/script changes |

Avoid touching integration files for every feature. Unnecessary changes increase conflict risk.

# 27. Your five feature request flows

## Feature 1: Elderly profile management

~~~text
CreateElderlyProfilePage or EditElderlyProfilePage
  -> ProfileForm
  -> elderlyProfileService
  -> /api/elderly-profiles
  -> elderlyProfileRoutes
  -> requireAuth and Family role
  -> validateElderlyProfile
  -> elderlyProfileController
  -> elderlyProfileAccessService, for existing profiles
  -> ElderlyProfile and ElderlyFamilyLink
  -> MongoDB
~~~

Why two models:

- ElderlyProfile stores health/personal information.
- ElderlyFamilyLink stores Family relationship and owner/editor/viewer permission.

## Feature 2: Gemini wellness insight

~~~text
ElderlyWellnessPage
  -> WellnessInsightsPanel
  -> wellnessInsightService / wellnessAlertService
  -> wellnessInsightRoutes
  -> Family auth and Premium entitlement
  -> wellnessInsightController
  -> wellnessInsightService
  -> wellnessAnalysisService
  -> geminiWellnessService
  -> WellnessReport, WellnessInsight, WellnessAlert
~~~

Responsibilities:

- Analysis service creates deterministic findings.
- Gemini service sanitizes/calls/validates provider data.
- Insight service orchestrates cache, provider, fallback, and persistence.
- Controller handles authorization and response.

## Feature 3: notifications

Consumer flow:

~~~text
NotificationBell or NotificationsPage
  -> NotificationContext
  -> frontend notificationService
  -> /api/notifications
  -> notificationRoutes
  -> notificationController
  -> Notification model
~~~

Producer flow:

~~~text
booking/wellness/payment/auth controller or service
  -> backend notificationService
  -> idempotent Notification upsert
  -> Notification collection
~~~

NotificationContext owns shared unread state and polling. NotificationBell renders the top-bar interaction.

## Feature 4: subscription and payment

Family flow:

~~~text
FamilySubscriptionPage
  -> subscription components
  -> SubscriptionContext / frontend subscriptionService
  -> /api/subscriptions
  -> subscriptionRoutes
  -> validation and Family role
  -> subscriptionController
  -> subscriptionService / prototypePaymentService / stripePaymentService
  -> SubscriptionPlan, FamilySubscription, SubscriptionPayment
~~~

Stripe webhook flow:

~~~text
Stripe
  -> raw body in app.js
  -> stripeWebhookRoutes
  -> stripeWebhookController
  -> stripePaymentService
  -> transaction
  -> payment and subscription models
~~~

Admin flow:

~~~text
AdminSubscriptionPaymentsPage
  -> adminService
  -> /api/admin
  -> adminUserRoutes
  -> Admin role
  -> adminSubscriptionController
  -> aggregation and paginated payment history
~~~

## Feature 5: Family account and email re-verification

~~~text
FamilyAccountPage
  -> AuthContext / authService
  -> /api/auth/account
  -> authRoutes
  -> requireAuth, Family role, validateAuth
  -> authController
  -> User and EmailVerificationToken
  -> authTokens and emailService
  -> session cleared when email changes
  -> login/verification screen
~~~

Token rule:

~~~text
raw token goes to email
hashed token goes to MongoDB
~~~

# 28. Requirement-to-files examples

## Add a new field to an elderly profile

~~~text
backend/models/ElderlyProfile.js
backend/middleware/validateElderlyProfile.js
backend/controllers/elderlyProfileController.js
frontend/src/components/elderly/ProfileForm.jsx
frontend detail page/component
~~~

Route/service may not change if the existing request already sends the complete payload.

## Add a button that calls an existing API

~~~text
React page/component
possibly frontend service if method does not exist
CSS if needed
~~~

Do not change model, controller, or route if the API already supports the action.

## Add a new API action to an existing feature

~~~text
validation middleware
existing controller or backend service
existing route file
frontend service
page/component button and state
~~~

Do not mount another app.js prefix.

## Add a completely new collection and page

~~~text
backend/model
backend/validation
backend/controller
backend/service if complex
backend/route
backend/app.js route mount
backend/test or smoke script
frontend/service
frontend/page
frontend/component if needed
frontend/App.jsx route
navigation if needed
feature stylesheet if needed
~~~

## Show a count from another collection

~~~text
existing controller/service query
existing API response
frontend page/component display
~~~

A new model or route may not be required.

## Add a shared unread badge

~~~text
backend query/controller
frontend service
shared context
reusable component
top navigation integration
~~~

## Add an external API

~~~text
backend config/env
backend service
controller/service orchestration
fallback/error handling
focused tests
frontend service/page only for returned result
~~~

Never expose provider secret keys in frontend environment variables.

# 29. Common placement mistakes

Do not:

- Put MongoDB queries in React.
- Put Axios calls directly in many components when a feature service exists.
- Put business transactions in route files.
- Put JSX in frontend services.
- Put request/response handling inside Mongoose models.
- Put one-page form state in global context.
- Mount a second route prefix for an endpoint belonging to an existing router.
- Put a secret provider key in VITE environment variables.
- Duplicate authorization logic without checking existing access services.
- Add package dependencies when existing code can perform the requirement clearly.
- Edit node_modules.

# 30. File checklist for a new full-stack feature

Before coding:

~~~text
[ ] Closest existing feature found
[ ] API contract written
[ ] Existing or new model decided
[ ] Actor and resource permission decided
~~~

Backend:

~~~text
[ ] Model/field
[ ] Validation middleware
[ ] Resource authorization
[ ] Controller
[ ] Service if reusable/complex
[ ] Route
[ ] app.js only if new route group
[ ] Unit or authenticated smoke test
~~~

Frontend:

~~~text
[ ] Frontend service
[ ] Page or existing page selected
[ ] Components selected
[ ] Loading/error/empty/data states
[ ] Submit/action loading state
[ ] App.jsx only if new route
[ ] Navigation only if useful
[ ] Styling and accessibility
~~~

Final:

~~~text
[ ] Backend method/path equals frontend service
[ ] Request body equals validation contract
[ ] Response equals React state usage
[ ] Correct role succeeds
[ ] Wrong role/owner fails
[ ] Database write/read verified
[ ] Syntax/build/diff checks pass
~~~

# 31. Fast explanation

"The browser route renders a page composed from feature components. The page or shared context calls a frontend service, which uses the shared Axios client. Express app.js sends that URL to the feature router. The router applies authentication, role/entitlement, and validation before the controller. The controller performs HTTP coordination and calls a backend service for reusable, transactional, or provider logic. The service reads or writes Mongoose models. The controller returns the standard success/data response, the frontend service extracts response.data.data, and React updates the screen."
