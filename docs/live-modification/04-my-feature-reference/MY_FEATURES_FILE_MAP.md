# My Assigned Features: Repository File Map

This map separates primary feature files from shared integration files. Shared files contain other team features too, so modify only the relevant section during practice.

## 1. Elderly Health Profile Management

### Backend primary files

- backend/models/ElderlyProfile.js
- backend/models/ElderlyFamilyLink.js
- backend/controllers/elderlyProfileController.js
- backend/routes/elderlyProfileRoutes.js
- backend/middleware/validateElderlyProfile.js
- backend/services/elderlyProfileAccessService.js
- backend/scripts/smokeElderlyProfiles.js

### Frontend primary files

- frontend/src/services/elderlyProfileService.js
- frontend/src/components/elderly/ProfileForm.jsx
- frontend/src/pages/elderly/CreateElderlyProfilePage.jsx
- frontend/src/pages/elderly/EditElderlyProfilePage.jsx
- frontend/src/pages/elderly/ElderlyProfileListPage.jsx
- frontend/src/pages/elderly/ElderlyProfileDetailPage.jsx
- frontend/src/components/elderly/ProfileFeatureHub.jsx

### Shared integration files

- backend/app.js
- backend/controllers/authController.js
- frontend/src/App.jsx
- frontend/src/pages/OnboardingPage.jsx
- frontend/src/pages/DashboardPage.jsx
- frontend/src/components/AppHeader.jsx
- frontend/src/styles/global.css

The wellness and care-task pages use an elderly profile ID, but they are separate features:

- frontend/src/pages/elderly/ElderlyWellnessPage.jsx
- frontend/src/pages/elderly/ElderlyCareTasksPage.jsx

## 2. Gemini Wellness Summary and Fallback

### Backend primary files

- backend/models/WellnessReport.js
- backend/models/WellnessInsight.js
- backend/services/geminiWellnessService.js
- backend/services/wellnessInsightService.js
- backend/services/wellnessAnalysisService.js
- backend/controllers/wellnessInsightController.js
- backend/routes/wellnessInsightRoutes.js
- backend/config/env.js
- backend/test/wellnessInsights.test.js

### Frontend primary files

- frontend/src/services/wellnessInsightService.js
- frontend/src/components/wellness/WellnessInsightsPanel.jsx
- frontend/src/pages/wellness/WellnessReportDetailPage.jsx
- frontend/src/pages/elderly/ElderlyWellnessPage.jsx

### Related wellness input files

- backend/controllers/wellnessReportController.js
- backend/routes/wellnessReportRoutes.js
- frontend/src/services/wellnessReportService.js
- frontend/src/components/wellness/WellnessReportForm.jsx
- frontend/src/pages/caregiver/WellnessReportEditorPage.jsx

## 3. In-app Notifications

### Backend primary files

- backend/models/Notification.js
- backend/services/notificationService.js
- backend/controllers/notificationController.js
- backend/routes/notificationRoutes.js
- backend/test/notificationController.test.js

### Backend notification producers

- backend/controllers/bookingWorkflowController.js
- backend/controllers/wellnessReportController.js
- backend/controllers/doctorAppointmentController.js
- backend/controllers/groceryRequestController.js
- backend/controllers/caregiverFeedbackController.js

### Frontend primary files

- frontend/src/context/NotificationContext.jsx
- frontend/src/services/notificationService.js
- frontend/src/components/notifications/NotificationBell.jsx
- frontend/src/pages/NotificationsPage.jsx
- frontend/src/utils/notificationHelpers.js
- frontend/src/styles/notifications.css

### Shared integration files

- backend/app.js
- frontend/src/App.jsx
- frontend/src/components/AppHeader.jsx
- frontend/src/main.jsx

## 4. Family Subscription, Payment, Premium Access, and Admin Analytics

### Backend models and configuration

- backend/models/SubscriptionPlan.js
- backend/models/SubscriptionPayment.js
- backend/models/FamilySubscription.js
- backend/config/subscriptionPlans.js
- backend/utils/subscriptionConstants.js
- backend/utils/subscriptionPeriod.js

### Backend logic

- backend/services/subscriptionService.js
- backend/services/subscriptionPlanService.js
- backend/services/prototypePaymentService.js
- backend/services/stripePaymentService.js
- backend/services/subscriptionReminderService.js
- backend/controllers/subscriptionController.js
- backend/controllers/adminSubscriptionController.js
- backend/controllers/stripeWebhookController.js
- backend/middleware/validateSubscription.js
- backend/routes/subscriptionRoutes.js
- backend/routes/stripeWebhookRoutes.js

### Backend scripts and tests

- backend/scripts/syncSubscriptionPlans.js
- backend/scripts/smokeSubscriptions.js
- backend/test/subscriptionPeriod.test.js
- backend/test/subscriptionPaymentHelpers.test.js
- backend/test/subscriptionAccess.test.js
- backend/test/stripePaymentHelpers.test.js
- backend/test/subscriptionValidation.test.js

### Frontend primary files

- frontend/src/context/SubscriptionContext.jsx
- frontend/src/services/subscriptionService.js
- frontend/src/pages/family/FamilySubscriptionPage.jsx
- frontend/src/pages/admin/AdminSubscriptionPaymentsPage.jsx
- frontend/src/components/admin/AdminBusinessAnalytics.jsx
- frontend/src/components/subscription/SubscriptionStatusCard.jsx
- frontend/src/components/subscription/SubscriptionExpiryModal.jsx
- frontend/src/components/subscription/PremiumFeatureGate.jsx
- frontend/src/components/subscription/CurrentSubscriptionCard.jsx

### Shared integration files

- backend/app.js
- frontend/src/App.jsx
- frontend/src/components/AppHeader.jsx
- frontend/src/pages/DashboardPage.jsx
- frontend/src/styles/global.css
- render.yaml

## 5. Family Account Management and Email Re-verification

### Backend primary files

- backend/models/User.js
- backend/models/EmailVerificationToken.js
- backend/models/PasswordResetToken.js
- backend/controllers/authController.js
- backend/routes/authRoutes.js
- backend/middleware/validateAuth.js
- backend/services/emailService.js
- backend/utils/authTokens.js
- backend/utils/userResponse.js

### Backend support and tests

- backend/scripts/testEmailDelivery.js
- backend/scripts/smokeFamilyAccount.js
- backend/test/familyAccount.test.js
- backend/test/passwordReset.test.js
- backend/config/env.js

### Frontend primary files

- frontend/src/pages/family/FamilyAccountPage.jsx
- frontend/src/services/authService.js
- frontend/src/context/AuthContext.jsx
- frontend/src/pages/auth/VerifyEmailPage.jsx
- frontend/src/pages/auth/ForgotPasswordPage.jsx
- frontend/src/pages/auth/ResetPasswordPage.jsx

### Shared integration files

- backend/app.js
- frontend/src/App.jsx
- frontend/src/components/AppHeader.jsx
- frontend/src/styles/global.css

## Fast file-finding commands

Find a route:

~~~powershell
rg -n "elderly-profiles" backend frontend/src
~~~

Find a controller function:

~~~powershell
rg -n "function createElderlyProfile" backend
~~~

Find every place a service method is called:

~~~powershell
rg -n "elderlyProfileService.getProfile" frontend/src
~~~

Find a database model reference:

~~~powershell
rg -n "ElderlyFamilyLink" backend
~~~