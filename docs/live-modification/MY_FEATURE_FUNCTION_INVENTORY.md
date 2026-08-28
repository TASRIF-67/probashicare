# My Feature Function Inventory

Use this file to answer: "Which file owns this behavior?", "Which function should I modify?", and "What calls it next?" Models and route files may not define named functions; their required responsibility is still listed.

## Feature 1: Elderly Health Profile Management

### Backend

- `backend/models/ElderlyProfile.js`
  - `elderlyProfileSchema`: defines personal information and embedded medical arrays.
  - Schema indexes: support owner/status listing.
  - `ElderlyProfile`: model used for profile CRUD.
- `backend/models/ElderlyFamilyLink.js`
  - `elderlyFamilyLinkSchema`: connects one family user to one profile with owner/editor/viewer permission.
  - Compound unique index: prevents a duplicate family/profile link.
  - `ElderlyFamilyLink`: model used by authorization queries.
- `backend/controllers/elderlyProfileController.js`
  - `toProfileResponse(profile, link)`: converts a Mongoose document and adds caller permission.
  - `synchronizeOwnerRelationship(profile, link)`: copies the profile relationship into the owner link and saves when changed.
  - `createElderlyProfile(request, response)`: transactionally creates profile plus owner link.
  - `listElderlyProfiles(request, response)`: lists only linked profiles visible to the signed-in family.
  - `getElderlyProfile(request, response)`: returns one authorized profile.
  - `updateElderlyProfile(request, response)`: replaces all editable profile sections.
  - `updatePersonalInformation(request, response)`: updates only personal information.
  - `updateProfileSection(request, response)`: updates one allowed medical/contact array.
  - `archiveElderlyProfile(request, response)`: owner-only soft archive.
- `backend/middleware/validateElderlyProfile.js`
  - `validatePersonalInformation`: validates required identity fields and date rules.
  - `validateSectionShapes`: confirms repeated sections are arrays.
  - `validateEmergencyContacts`: validates contact fields and primary-contact rules.
  - `validateMedications`: validates medication-specific fields.
  - `validateElderlyProfilePayload`: coordinates validation and calls `next` or throws 422.
- `backend/services/elderlyProfileAccessService.js`
  - `familyHasActiveElderlyProfiles(familyUserId)`: onboarding check.
  - `getAuthorizedElderlyProfile(options)`: concealed-404 access lookup and permission enforcement.
- `backend/routes/elderlyProfileRoutes.js`
  - Route table: maps methods/URLs to authentication, role, ObjectId, payload, and controller middleware.
- `backend/scripts/smokeElderlyProfiles.js`
  - `callApi`: sends an authenticated test request and verifies status.
  - `createTemporaryFamily`: creates a verified test family.
  - `runSmokeTest`: exercises create/list/get/update/archive permissions.
  - `cleanup`: removes only the test fixtures created by the script.
  - `startSmokeTest`: connects, runs, catches errors, cleans up, and disconnects.

### Frontend

- `frontend/src/services/elderlyProfileService.js`
  - `createProfile`, `listProfiles`, `getProfile`, `updateProfile`, `updatePersonalInformation`, `updateSection`, `archiveProfile`: Axios methods matching backend endpoints.
- `frontend/src/components/elderly/ProfileForm.jsx`
  - `createInitialValue`: converts an existing profile or defaults into form state.
  - `cleanDate`: produces date-input text.
  - `calculateApproximateAge`: derives display age.
  - `createSectionItem`: creates one empty repeated-section row.
  - `RepeatedSection`: renders add/edit/remove controls for embedded arrays.
  - `ProfileForm`: owns the multi-step controlled form and submits its final value.
- `CreateElderlyProfilePage`: submits a new profile and redirects to its detail page.
- `EditElderlyProfilePage`: loads, edits, and saves an existing profile.
- `ElderlyProfileListPage` helpers: calculate age, get name, filter, calculate class names, render summary/card, and load directory state.
- `ElderlyProfileDetailPage` helpers: format/humanize data, render each medical section, sort contacts, load a profile, and archive it.

## Feature 2: Gemini Wellness Summary and Fallback

### Backend

- `backend/models/WellnessInsight.js`
  - Schema: stores source report IDs/signature, period, summary, highlights, follow-up, provider, and generation time.
  - Indexes: support latest-insight and same-report-signature queries.
- `backend/services/geminiWellnessService.js`
  - getFiniteNumberOrNull(value): accepts only real finite numeric values for the provider payload.
  - sanitizeReportsForGemini(reports): creates an anonymous whitelist; IDs, names, and unrestricted notes are excluded.
  - `validateGeminiOutput(value)`: treats provider JSON as untrusted and returns only bounded valid fields.
  - `generateGeminiWellnessSummary(reports, options)`: builds prompt/schema, calls Gemini with timeout, parses JSON, and returns null on failure.
- `backend/services/wellnessInsightService.js`
  - `buildReportSignature(reports)`: stable sorted ID signature for reuse.
  - `buildFallbackWellnessSummary(analysis)`: always-available, non-diagnostic summary.
  - `getLatestWellnessInsight(profileId)`: latest saved insight query.
  - `generateWellnessInsight(profileId)`: orchestrates analysis, cache lookup, Gemini/fallback selection, and persistence.
- `backend/services/wellnessAnalysisService.js`
  - `createRuleResult`: consistent deterministic finding shape.
  - `analyzeBloodPressure`, `analyzeBloodSugar`, `analyzeWeight`, `analyzeDailyWellness`: rule-specific checks.
  - `buildDedupeKey`: stable rule/report key.
  - `analyzeRecentWellnessReports`: queries newest submitted reports.
  - `analyzeWellnessReportValues`: runs rules against submitted values only.
  - `analyzeAndCreateWellnessAlerts`: upserts only missing alerts.
- `backend/controllers/wellnessInsightController.js`
  - `getAuthorizedAlert`: loads alert, then verifies family/profile link.
  - `listWellnessAlerts`: filters/paginates alerts and returns severity totals.
  - `getWellnessAlert`: returns one authorized populated alert.
  - `acknowledgeWellnessAlert`: atomic active-to-acknowledged transition.
  - `resolveWellnessAlert`: atomic active/acknowledged-to-resolved transition.
  - `getLatestInsight`: returns saved insight or null after access check.
  - `generateInsight`: generates/reuses an insight after access and premium checks.
- `backend/routes/wellnessInsightRoutes.js`
  - Route table: family auth, premium entitlements, ObjectId/filter validation, and controllers.
- `backend/test/wellnessInsights.test.js`
  - `report(overrides)`: creates safe synthetic input for sanitizer, rules, fallback, and failure tests.

### Frontend

- `frontend/src/services/wellnessAlertService.js`
  - `listAlerts`, `acknowledgeAlert`, `resolveAlert`: paginated alert and status-workflow API calls.
- `frontend/src/services/wellnessInsightService.js`
  - `getLatestInsight(profileId)`: GET latest saved insight.
  - `generateInsight(profileId)`: POST on-demand generation.
- `frontend/src/components/wellness/WellnessInsightsPanel.jsx`
  - `formatDate`, `humanize`, `getReportWord`: date, enum, and plural-label display helpers.
  - `loadAlerts`, `loadInsight`: fetch page data.
  - `changeFilter`: updates filter state and resets pagination.
  - `acknowledge`, `openResolve`, `closeResolve`, `resolve`: alert workflow.
  - `generate`: requests Gemini/fallback summary and shows provider-aware feedback.

## Feature 3: In-app Notifications

### Backend

- `backend/models/Notification.js`
  - Schema: stores recipient/actor, event content, read/dismissal state, navigation, related record, legacy-compatible fields, and timestamps.
  - Recipient/date and recipient/read indexes support history and unread queries.
  - Partial unique deduplication index prevents concurrent duplicate events while allowing legacy records.
- `backend/services/notificationService.js`
  - `createNotification(input)`: builds the per-recipient event key and performs an idempotent `$setOnInsert` upsert with an optional transaction session.
  - `createNotificationsForUsers(input)`: uses a Set to deduplicate recipients, then creates one event per unique user.
- `backend/controllers/notificationController.js`
  - `readPositiveInteger(value, fallback, maximum)`: normalizes page/limit query values.
  - `listNotifications(request, response)`: concurrently loads a caller-owned page, global unread count, and filtered total.
  - `markNotificationRead(request, response)`: atomically marks one owned notification read with concealed 404 behavior.
  - `markAllNotificationsRead(request, response)`: bulk-updates every caller-owned unread record with one timestamp.
  - `dismissNotification(request, response)`: calculates and stores a caller-owned reminder pause time.
- `backend/routes/notificationRoutes.js`: applies authentication to all endpoints and keeps the fixed read-all route before dynamic ID routes.
- `backend/test/notificationController.test.js`: tests owner filters, pagination, mark-one, mark-all, and dismissal time.
- `backend/scripts/smokeNotifications.js`
  - `startServer` and `stopServer`: manage a random-port Express listener.
  - `callApi`: sends JSON/cookies and validates status.
  - `createTemporaryFamily` and `login`: create verified test users and real sessions.
  - `createFixtureNotification`: creates marked idempotent fixtures.
  - `runSmokeTest`: verifies authentication, isolation, deduplication, read, bulk read, and unread list behavior.
  - `cleanup` and `startSmokeTest`: remove marker-owned fixtures and always close server/database.
- Producer controllers call `createNotification` or `createNotificationsForUsers` after or inside successful business workflows.

### Frontend

- `frontend/src/context/NotificationContext.jsx`
  - `NotificationProvider`: owns recent records, unread count, loading/error state, 15-second polling, context mutations, cleanup, memoized value, and user-reset behavior.
  - `refreshUnreadCount`: loads only the small bell count.
  - `loadNotifications`: loads a requested preview page into shared state.
  - `markAsRead` and `markAllAsRead`: synchronize API and functional local state.
  - `useNotifications`: returns the exact context value and rejects use outside the provider.
- `frontend/src/services/notificationService.js`
  - `list` and `listNotifications`: authenticated list requests with Axios query params.
  - `getUnreadCount`: minimal unread query.
  - `markRead` and `markAsRead`: one-record PATCH plus compatibility wrapper.
  - `markAllAsRead`: bulk PATCH.
  - `dismiss`: reminder pause PATCH.
- `frontend/src/components/notifications/NotificationBell.jsx`
  - `getNotificationPagePath`: chooses role-aware history route.
  - `getItemClassName`: distinguishes unread rows.
  - `formatUnreadCount`: caps badge text at 99+.
  - `formatNotificationTime`: formats local timestamps.
  - `NotificationBell`: handles preview load, outside/Escape cleanup, read actions, mark-all, and navigation.
- `frontend/src/pages/NotificationsPage.jsx`
  - `formatNotificationDate`, `getFilterButtonClass`, and `getHistoryItemClass`: display helpers.
  - `loadNotifications`: loads active page/filter.
  - `changeFilter`, `markRead`, `markAllRead`, `openNotification`, and `dismiss`: user actions.
  - `renderNotificationContent`: explicit loading, empty, and history rendering without a nested ternary.
- `frontend/src/utils/notificationHelpers.js`
  - `getNotificationPath`: prefers current actionPath, supports legacy actionUrl, then uses a safe fallback.
  - `isReminderNotification`: identifies reminder types eligible for dismissal.
## Feature 4: Subscription, Payment, Premium Access, and Analytics

### Backend models, configuration, and date rules

- `backend/utils/subscriptionConstants.js`
  - `SUBSCRIPTION_PLAN_CODES`, `PAYMENT_METHODS`, `ENTITLEMENTS`, and `PREMIUM_ENTITLEMENTS`: shared allowlists used by schemas, validation, plans, and authorization.
- `backend/config/subscriptionPlans.js`
  - `SUBSCRIPTION_PLAN_DEFINITIONS`: backend-authoritative product name, price, currency, duration, features, and active state.
- `backend/utils/subscriptionPeriod.js`
  - Date helpers calculate hour, month, and year periods and clamp month-end overflow safely.
- `backend/models/SubscriptionPlan.js`
  - Catalog schema and unique plan-code index.
- `backend/models/FamilySubscription.js`
  - One current subscription per Family, trial history, exact period, access level, and plan snapshot.
  - Unique Family index prevents duplicate current-access records.
- `backend/models/SubscriptionPayment.js`
  - Payment attempt, historical plan snapshot, transaction/confirmation references, provider identifiers, status, and timestamps.
  - Family-history, status, and partial unique Stripe indexes support queries and idempotency.

### Backend access and plan services

- `backend/services/entitlementService.js`
  - `createCoreAccess(status, expiresAt)`: internal consistent Core result.
  - `determineSubscriptionAccess(subscription, now)`: calculates effective access from status and exact expiry.
  - `hasEntitlement(access, entitlement)`: checks a known code against effective features.
- `backend/services/subscriptionService.js`
  - `getOrCreateFamilySubscription(familyUserId, options)`: loads or race-safely creates one Family record.
  - `synchronizeSubscriptionExpiry(subscription, options)`: atomically marks due active/trialing access expired.
  - `getFamilySubscriptionAccess(familyUserId, options)`: returns stored subscription and effective access.
  - `activateFamilyTrial(familyUserId)`: atomically enforces one-time trial use and calculates its period.
- `backend/services/subscriptionPlanService.js`
  - `synchronizeSubscriptionPlans()`: upserts code-defined plans into MongoDB.
- `backend/middleware/requireFamilyEntitlement.js`
  - `requireFamilyEntitlement(entitlement)`: validates a known code at startup and returns Express middleware that denies non-Family/Core/expired access.

### Backend prototype and Stripe payments

- `backend/services/prototypePaymentService.js`
  - `createPlanSnapshot(plan)`: copies authoritative historical terms.
  - `generatePrototypeTransactionReference()` and `generatePrototypeConfirmationReference()`: unique development references.
  - `requirePrototypePaymentsEnabled()`: configuration gate.
  - `createPrototypePayment(familyUserId, input)`: creates caller-owned pending payment.
  - `completePrototypePayment(familyUserId, paymentId)`: transactionally completes payment and activates/renews access.
  - `expireStalePrototypePayments(options)`: cancels abandoned pending attempts.
  - `finishPrototypePayment(familyUserId, paymentId, outcome, reason)`: shared failure/cancellation state transition.
- `backend/services/stripePaymentService.js`
  - `requireStripePaymentsEnabled()` and internal `getStripeClient()`: validate config and lazily build the SDK client.
  - `convertBdtToStripeMinorUnits(amount)`: converts BDT plan values to provider integer units.
  - `createStripeCheckoutSession(familyUserId, planCode)`: creates local pending history plus hosted Checkout.
  - `validateStripeCheckoutPayment(session, payment)`: verifies paid status, amount, currency, and metadata.
  - `completeStripeCheckoutPayment(session)`: transactionally grants access once.
  - Internal `finishStripeCheckout(...)`: handles provider failure/expiry terminal states.
  - `constructStripeWebhookEvent(rawBody, signature)`: cryptographically verifies raw signed bytes.
  - `processStripeWebhookEvent(event)`: routes supported event types idempotently.
  - `getStripeCheckoutStatus(familyUserId, sessionId)`: caller-owned local status.
  - `cancelOwnedStripeCheckout(familyUserId, paymentId)`: expires open provider checkout and updates local state.

### Backend reminders, controllers, validation, and routes

- `backend/services/subscriptionReminderService.js`
  - `getReminderThresholds(subscription)`: trial, day-pass, and longer-plan thresholds.
  - Internal `createExpiryNotification` and `createThresholdReminder`: idempotent notification builders.
  - `synchronizeSubscriptionReminders(familyUserId, subscription)`: request-driven reminder synchronization.
- `backend/controllers/subscriptionController.js`
  - Internal `readPositiveInteger`: bounded pagination parser.
  - `listSubscriptionPlans`, `getMySubscription`, `activateMyTrial`, and `cancelMySubscription`: catalog/access actions.
  - `purchaseSubscription`, `simulatePaymentSuccess`, `simulatePaymentFailure`, and `cancelPrototypePayment`: prototype lifecycle.
  - `createStripeCheckout`, `getMyStripeCheckoutStatus`, and `cancelStripeCheckout`: Family Stripe lifecycle.
  - `listMySubscriptionPayments`: caller-owned paginated history.
- `backend/controllers/adminSubscriptionController.js`
  - `escapeRegularExpression(value)`: makes Admin transaction search literal and regex-safe.
  - `getSubscriptionAnalytics`: aggregates status/revenue/access/plan totals and recent history.
  - `listSubscriptionPayments`: validates filters and returns populated paginated Admin history.
- `backend/controllers/stripeWebhookController.js`
  - `receiveStripeWebhook`: verifies/processes provider event and acknowledges it.
- `backend/middleware/validateSubscription.js`
  - `validateSubscriptionPurchase`: allows only prototype methods and trusted plan codes.
  - `validateStripeCheckout`: validates hosted Checkout plan code.
  - `validateSubscriptionObjectId(parameterName)`: creates concealed-404 ObjectId middleware.
  - `validateSubscriptionCancellation` and `validateReminderDismissal`: bounded input validation.
- `backend/routes/subscriptionRoutes.js`: authentication, Family role, validation, and controllers.
- `backend/routes/stripeWebhookRoutes.js`: signed provider route without user authentication.
- `backend/app.js`: mounts raw Stripe body handling before general JSON parsing.
- `backend/routes/adminUserRoutes.js`: Admin analytics and payment-history endpoints.

### Backend scripts and tests

- `backend/scripts/syncSubscriptionPlans.js`
  - `runSubscriptionPlanSynchronization`, `handleSynchronizationFailure`, and `closeDatabaseConnection`: safe plan synchronization lifecycle.
- `backend/scripts/smokeSubscriptions.js`
  - `readSessionCookie`, `callApi`, `createUser`, and `login`: authenticated test infrastructure.
  - `verifyCatalogAndRoleProtection`, `verifyTrialWorkflow`, `verifySuccessfulPaymentWorkflow`, `verifyUnsuccessfulPaymentWorkflow`, and `verifyHistoryAndAdminReporting`: full behavior checks.
  - `run`, `closeServer`, `cleanup`, and `handleFailure`: fixture lifecycle.
- `backend/test/subscriptionPeriod.test.js`: duration and month-end date math.
- `backend/test/subscriptionAccess.test.js`: Core/Premium/expiry/entitlement behavior.
- `backend/test/subscriptionPaymentHelpers.test.js`: snapshots, references, and reminder thresholds.
- `backend/test/subscriptionValidation.test.js`: prototype/Stripe separation and safe Admin search.
- `backend/test/stripePaymentHelpers.test.js`: minor units and verified session values.

### Frontend

- `frontend/src/services/subscriptionService.js`
  - `listPlans`, `getMySubscription`, `activateTrial`, and `listPayments`: reads.
  - `purchase`, `simulateSuccess`, `simulateFailure`, and `cancelPayment`: prototype lifecycle.
  - `createStripeCheckout`, `getStripeCheckoutStatus`, and `cancelStripeCheckout`: hosted checkout lifecycle.
  - `dismissReminder`: persists a reminder pause.
- `frontend/src/context/SubscriptionContext.jsx`
  - `SubscriptionProvider`: shared Family access state and refresh.
  - `refreshSubscription`: authenticated reload.
  - `useSubscription`: exact context value with provider guard.
- `frontend/src/pages/family/FamilySubscriptionPage.jsx`
  - `formatDateTime`, `formatPlanDuration`, `formatPaymentMethod`, and `waitForDelay`: display/polling helpers.
  - `SubscriptionPlanCard`, `PaymentHistoryRow`, and `SubscriptionCheckoutModal`: readable page sections.
  - `FamilySubscriptionPage`: plan, trial, payment, return reconciliation, reminder, and pagination state.
  - Page handlers: `selectPlan`, `changePaymentMethod`, `activateTrial`, `beginStripeCheckout`, `beginPrototypeCheckout`, `finishPrototypeCheckout`, `closeCheckout`, and `dismissReminder`.
- `frontend/src/components/subscription/CurrentSubscriptionCard.jsx`
  - Date/count/remaining/progress/name/assurance helpers and exact access period UI.
- `frontend/src/components/subscription/SubscriptionStatusCard.jsx`: compact dashboard access state.
- `frontend/src/components/subscription/SubscriptionExpiryModal.jsx`: controlled renewal reminder.
- `frontend/src/components/subscription/PremiumFeatureGate.jsx`: upgrade guidance, not backend security.
- `frontend/src/components/admin/AdminBusinessAnalytics.jsx`
  - `formatMoney`, `AnalyticsMetric`, and `AdminBusinessAnalytics`: Admin totals and plan performance.
- `frontend/src/pages/admin/AdminSubscriptionPaymentsPage.jsx`
  - Date/method/plural helpers, `AdminPaymentRow`, filters, search, and pagination.

## Feature 5: Family Account Management and Email Re-verification

### Backend

- `backend/models/User.js`: account identity, role, password hash, verification status, and profile fields.
- `EmailVerificationToken.js` and `PasswordResetToken.js`: hashed, expiring, one-purpose tokens.
- `backend/controllers/authController.js`
  - `issueVerificationEmail(user)`: creates hashed verification-token record and emails raw token URL.
  - `issuePasswordResetEmail(user)`: creates reset-token record and sends reset URL.
  - `hasLinkedElderlyProfiles(userId)`: determines family onboarding state.
  - `completeLogin(response, user)`: creates session cookie and standardized public response.
  - `signup`, `caregiverSignup`: create role-specific unverified accounts and send verification.
  - `login`, `googleLogin`: authenticate and preserve existing role/onboarding redirects.
  - `forgotPassword`, `resetPassword`: privacy-preserving reset request and token/password update.
  - `verifyEmail`, `resendVerification`: consume or replace email-verification tokens.
  - `getCurrentUser`: authenticated public user/access response.
  - `updateFamilyAccount`: owner-only name/email update; password confirmation and re-verification on email change.
  - `logout`: clears authentication cookie.
- `backend/middleware/validateAuth.js`: validates signup, login, reset, and family-account update payloads before controllers.
- `backend/services/emailService.js`
  - `escapeHtml`: prevents untrusted names from becoming HTML markup.
  - `requireMailConfiguration`, `getTransporter`: validate config and lazily build Nodemailer transport.
  - `verifyEmailTransport`: SMTP connection test.
  - `sendVerificationEmail`, `sendPasswordResetEmail`: create and send purpose-specific messages.
- `backend/utils/authTokens.js`
  - Session create/verify helpers use JWT.
  - Verification/reset create helpers generate random raw tokens.
  - Hash helpers store SHA-256 hashes instead of usable raw tokens.
- `toPublicUser`: returns only frontend-safe user fields.

### Frontend

- `frontend/src/services/authService.js`
  - `signup`, `caregiverSignup`, `login`, `loginWithGoogle`, `getCurrentUser`, `updateFamilyAccount`, `logout`, `verifyEmail`, `resendVerification`, `forgotPassword`, `resetPassword`.
- `AuthProvider`: owns current user, boot loading, signup/login/logout, Google login, and account refresh/update state.
- `useAuth`: returns the shared auth context.
- `FamilyAccountPage`: controlled name/email form; asks for current password only when the email changes and handles forced logout/reverification.
- `VerifyEmailPage`: reads token from URL and calls verification service.
- `ForgotPasswordPage`: accepts email while keeping the server response privacy-safe.
- `ResetPasswordPage`: reads reset token, validates matching password fields, and submits replacement.

## Best functions to memorize first

If time is limited, practice these until you can reproduce their shape:

1. `getAuthorizedElderlyProfile`
2. `createElderlyProfile`
3. `validateElderlyProfilePayload`
4. Frontend `load...` effect and controlled form handler
5. `sanitizeReportsForGemini`
6. `generateGeminiWellnessSummary`
7. `generateWellnessInsight`
8. `createNotification` and `markAllNotificationsRead`
9. `getFamilySubscriptionAccess`
10. `completeStripeCheckoutPayment` and `processStripeWebhookEvent`
11. `updateFamilyAccount`
12. `issueVerificationEmail`

Do not memorize every line. Memorize each function's input, authorization position, database query, result shape, failure path, and caller/callee relationship.
