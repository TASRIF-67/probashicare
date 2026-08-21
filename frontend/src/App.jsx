import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { CaregiverApplicationRoute } from "./components/CaregiverApplicationRoute.jsx";
import { CaregiverThemeRoute } from "./components/caregiver/CaregiverTheme.jsx";
import { AdminLayout } from "./components/admin/AdminLayout.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import { CaregiverBrowsePage } from "./pages/family/CaregiverBrowsePage.jsx";
import { OnboardingPage } from "./pages/OnboardingPage.jsx";
import { UnauthorizedPage } from "./pages/UnauthorizedPage.jsx";
import { LoginPage } from "./pages/auth/LoginPage.jsx";
import { SignupPage } from "./pages/auth/SignupPage.jsx";
import { VerifyEmailPage } from "./pages/auth/VerifyEmailPage.jsx";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage.jsx";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage.jsx";
import { CreateElderlyProfilePage } from "./pages/elderly/CreateElderlyProfilePage.jsx";
import { EditElderlyProfilePage } from "./pages/elderly/EditElderlyProfilePage.jsx";
import { ElderlyProfileDetailPage } from "./pages/elderly/ElderlyProfileDetailPage.jsx";
import { ElderlyProfileListPage } from "./pages/elderly/ElderlyProfileListPage.jsx";
import { ElderlyCareTasksPage } from "./pages/elderly/ElderlyCareTasksPage.jsx";
import { AdminAccountsPage } from "./pages/admin/AdminAccountsPage.jsx";
import { AdminOverviewPage } from "./pages/admin/AdminOverviewPage.jsx";
import { AdminSubscriptionPaymentsPage } from "./pages/admin/AdminSubscriptionPaymentsPage.jsx";
import { AdminBookingsPage } from "./pages/admin/AdminBookingsPage.jsx";
import { AdminCaregiverApplicationsPage } from "./pages/admin/AdminCaregiverApplicationsPage.jsx";
import { AdminCaregiverReviewPage } from "./pages/admin/AdminCaregiverReviewPage.jsx";
import { CaregiverApplicationPage } from "./pages/caregiver/CaregiverApplicationPage.jsx";
import { CaregiverApplicationStatusPage } from "./pages/caregiver/CaregiverApplicationStatusPage.jsx";
import { CaregiverDashboardPage } from "./pages/caregiver/CaregiverDashboardPage.jsx";
import { CaregiverTasksPage } from "./pages/caregiver/CaregiverTasksPage.jsx";
import { CaregiverProfilePage } from "./pages/caregiver/CaregiverProfilePage.jsx";
import { FamilyBookingsPage } from "./pages/family/FamilyBookingsPage.jsx";
import { CaregiverBookingsPage } from "./pages/caregiver/CaregiverBookingsPage.jsx";
import { WellnessReportEditorPage } from "./pages/caregiver/WellnessReportEditorPage.jsx";
import { WellnessReportListPage } from "./pages/caregiver/WellnessReportListPage.jsx";
import { ElderlyWellnessPage } from "./pages/elderly/ElderlyWellnessPage.jsx";
import { WellnessReportDetailPage } from "./pages/wellness/WellnessReportDetailPage.jsx";
import { FamilySubscriptionPage } from "./pages/family/FamilySubscriptionPage.jsx";
import { NotificationsPage } from "./pages/NotificationsPage.jsx";
import { HomePage } from "./pages/HomePage.jsx";
import { FamilyAccountPage } from "./pages/family/FamilyAccountPage.jsx";
import { FamilyWellnessHubPage } from "./pages/family/FamilyWellnessHubPage.jsx";
import { FamilyCareTasksHubPage } from "./pages/family/FamilyCareTasksHubPage.jsx";
import { CaregiverReviewsPage } from "./pages/caregiver/CaregiverReviewsPage.jsx";
import { AdminFeedbackPage } from "./pages/admin/AdminFeedbackPage.jsx";
import { CaregiverGroceriesPage } from "./pages/caregiver/CaregiverGroceriesPage.jsx";
import { CreateGroceryRequestPage } from "./pages/caregiver/CreateGroceryRequestPage.jsx";
import { FamilyGroceriesPage } from "./pages/family/FamilyGroceriesPage.jsx";
import { DoctorAppointmentPlanner } from "./components/doctor/DoctorAppointmentPlanner.jsx";
import { CaregiverDoctorVisits } from "./components/doctor/CaregiverDoctorVisits.jsx";

const PAGE_TITLES = [
  { path: "/caregiver/groceries/new", title: "New essentials request" },
  { path: "/caregiver/wellness-reports/new", title: "New wellness report" },
  { path: "/caregiver/doctor-visits", title: "Doctor visits" },
  { path: "/caregiver/groceries", title: "Essentials" },
  { path: "/caregiver/notifications", title: "Notifications" },
  { path: "/caregiver/wellness-reports", title: "Wellness reports" },
  { path: "/caregiver/tasks", title: "Care tasks" },
  { path: "/caregiver/reviews", title: "Caregiver reviews" },
  { path: "/caregiver/profile", title: "Caregiver profile" },
  { path: "/caregiver/bookings", title: "Caregiver bookings" },
  { path: "/caregiver/dashboard", title: "Caregiver dashboard" },
  { path: "/doctor-appointments", title: "Doctor appointments" },
  { path: "/wellness", title: "Wellness and vitals" },
  { path: "/care-tasks", title: "Care visit tasks" },
  { path: "/elderly-profiles", title: "Elderly profiles" },
  { path: "/notifications", title: "Notifications" },
  { path: "/subscription", title: "Subscription" },
  { path: "/caregivers", title: "Caregivers" },
  { path: "/bookings", title: "Bookings" },
  { path: "/groceries", title: "Essentials" },
  { path: "/dashboard", title: "Family dashboard" },
  { path: "/caregiver/signup", title: "Caregiver signup" },
  { path: "/signup", title: "Create account" },
  { path: "/login", title: "Sign in" },
  { path: "/forgot-password", title: "Forgot password" },
  { path: "/reset-password", title: "Reset password" },
  { path: "/admin", title: "Admin workspace" },
  { path: "/", title: "Connected elderly care" },
];

/**
 * Finds the most specific readable title for the current route.
 * @param {string} pathname - Current React Router pathname.
 * @returns {string} Page title without the product suffix.
 * @sideEffects None.
 */
function getPageTitle(pathname) {
  for (const page of PAGE_TITLES) {
    if (page.path === "/" && pathname === "/") {
      return page.title;
    }

    if (page.path !== "/" && pathname.startsWith(page.path)) {
      return page.title;
    }
  }

  return "Care workspace";
}

/**
 * Keeps route transitions understandable through titles and scroll position.
 * @returns {null} This behavior component renders no visible interface.
 * @sideEffects Updates the browser title and scrolls new pages to the top.
 */
function RouteExperience() {
  const location = useLocation();

  useEffect(() => {
    const pageTitle = getPageTitle(location.pathname);
    document.title = `${pageTitle} | ProbashiCare`;
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "auto",
    });
  }, [location.pathname]);

  return null;
}

/**
 * Moves keyboard focus directly to the current page content.
 * @returns {import("react").ReactElement} Focus-only accessibility link.
 * @sideEffects Focuses the first main element on activation.
 */
function SkipToContentLink() {
  /**
   * Finds and focuses the main page region.
   * @param {import("react").MouseEvent<HTMLAnchorElement>} event - Skip-link activation.
   * @returns {void}
   * @sideEffects Prevents anchor navigation and moves keyboard focus.
   */
  function focusMainContent(event) {
    event.preventDefault();
    const mainContent = document.querySelector("main");

    if (mainContent) {
      mainContent.setAttribute("tabindex", "-1");
      mainContent.focus();
    }
  }

  return (
    <a className="skip-to-content" href="#main-content" onClick={focusMainContent}>
      Skip to page content
    </a>
  );
}

/**
 * Declares public and role-protected application routes.
 * @param {void} _unused - This component accepts no props.
 * @returns {import("react").ReactElement} Router route tree.
 * @sideEffects React Router may redirect based on route and session state.
 */
export default function App() {
  return (
    <>
      <SkipToContentLink />
      <RouteExperience />
      <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/signup" element={<SignupPage initialMode="family" />} />
      <Route path="/caregiver/signup" element={<SignupPage initialMode="caregiver" />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route element={<ProtectedRoute roles={["family"]} />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/elderly-profiles/new" element={<CreateElderlyProfilePage />} />
        <Route path="/elderly-profiles" element={<ElderlyProfileListPage />} />
        <Route path="/account" element={<FamilyAccountPage />} />
      </Route>
      <Route element={<ProtectedRoute roles={["family"]} requireOnboarding />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/caregivers" element={<CaregiverBrowsePage />} />
        <Route path="/bookings" element={<FamilyBookingsPage />} />
        <Route path="/groceries" element={<FamilyGroceriesPage />} />
        <Route path="/doctor-appointments" element={<DoctorAppointmentPlanner />} />
        <Route path="/subscription" element={<FamilySubscriptionPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/wellness" element={<FamilyWellnessHubPage />} />
        <Route path="/wellness/:profileId" element={<ElderlyWellnessPage />} />
        <Route path="/wellness/:profileId/reports/:reportId" element={<WellnessReportDetailPage />} />
        <Route path="/care-tasks" element={<FamilyCareTasksHubPage />} />
        <Route path="/care-tasks/:profileId" element={<ElderlyCareTasksPage />} />
        <Route path="/elderly-profiles/:profileId" element={<ElderlyProfileDetailPage />} />
        {/* Compatibility routes preserve old bookmarks while the workspace uses dedicated tabs. */}
        <Route path="/elderly-profiles/:profileId/care-tasks" element={<ElderlyCareTasksPage />} />
        <Route path="/elderly-profiles/:profileId/edit" element={<EditElderlyProfilePage />} />
        <Route path="/elderly-profiles/:profileId/wellness" element={<ElderlyWellnessPage />} />
        <Route path="/elderly-profiles/:profileId/wellness-reports/:reportId" element={<WellnessReportDetailPage />} />
      </Route>
      <Route element={<ProtectedRoute roles={["admin"]} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverviewPage />} />
          <Route path="accounts" element={<AdminAccountsPage />} />
          <Route path="payments" element={<AdminSubscriptionPaymentsPage />} />
          <Route path="bookings" element={<AdminBookingsPage />} />
          <Route path="feedback" element={<AdminFeedbackPage />} />
          <Route path="caregivers" element={<AdminCaregiverApplicationsPage />} />
          <Route path="caregivers/:profileId" element={<AdminCaregiverReviewPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute roles={["caregiver"]} />}>
        <Route element={<CaregiverThemeRoute />}>
          <Route element={<CaregiverApplicationRoute allowedStatuses={["draft", "rejected"]} />}>
            <Route path="/caregiver/application" element={<CaregiverApplicationPage />} />
          </Route>
          <Route element={<CaregiverApplicationRoute allowedStatuses={["submitted", "suspended"]} />}>
            <Route path="/caregiver/application-status" element={<CaregiverApplicationStatusPage />} />
          </Route>
          <Route element={<CaregiverApplicationRoute allowedStatuses={["approved"]} />}>
            <Route path="/caregiver/dashboard" element={<CaregiverDashboardPage />} />
            <Route path="/caregiver/tasks" element={<CaregiverTasksPage />} />
            <Route path="/caregiver/profile" element={<CaregiverProfilePage />} />
            <Route path="/caregiver/bookings" element={<CaregiverBookingsPage />} />
            <Route path="/caregiver/reviews" element={<CaregiverReviewsPage />} />
            <Route path="/caregiver/groceries" element={<CaregiverGroceriesPage />} />
            <Route path="/caregiver/groceries/new" element={<CreateGroceryRequestPage />} />
            <Route path="/caregiver/doctor-visits" element={<CaregiverDoctorVisits />} />
            <Route path="/caregiver/notifications" element={<NotificationsPage />} />
            <Route path="/caregiver/wellness-reports" element={<WellnessReportListPage />} />
            <Route path="/caregiver/wellness-reports/new" element={<WellnessReportEditorPage />} />
            <Route path="/caregiver/wellness-reports/:reportId/edit" element={<WellnessReportEditorPage />} />
            <Route path="/caregiver/wellness-reports/:reportId" element={<WellnessReportDetailPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
