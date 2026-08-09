import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
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
import { CreateElderlyProfilePage } from "./pages/elderly/CreateElderlyProfilePage.jsx";
import { EditElderlyProfilePage } from "./pages/elderly/EditElderlyProfilePage.jsx";
import { ElderlyProfileDetailPage } from "./pages/elderly/ElderlyProfileDetailPage.jsx";
import { ElderlyProfileListPage } from "./pages/elderly/ElderlyProfileListPage.jsx";
import { AdminAccountsPage } from "./pages/admin/AdminAccountsPage.jsx";
import { AdminOverviewPage } from "./pages/admin/AdminOverviewPage.jsx";
import { AdminCaregiverApplicationsPage } from "./pages/admin/AdminCaregiverApplicationsPage.jsx";
import { AdminCaregiverReviewPage } from "./pages/admin/AdminCaregiverReviewPage.jsx";
import { CaregiverApplicationPage } from "./pages/caregiver/CaregiverApplicationPage.jsx";
import { CaregiverApplicationStatusPage } from "./pages/caregiver/CaregiverApplicationStatusPage.jsx";
import { CaregiverDashboardPage } from "./pages/caregiver/CaregiverDashboardPage.jsx";
import { CaregiverProfilePage } from "./pages/caregiver/CaregiverProfilePage.jsx";
import { CaregiverBookingsPage } from "./pages/caregiver/CaregiverBookingsPage.jsx";
import { WellnessReportEditorPage } from "./pages/caregiver/WellnessReportEditorPage.jsx";
import { WellnessReportListPage } from "./pages/caregiver/WellnessReportListPage.jsx";
import { FamilyBookingsPage } from "./pages/family/FamilyBookingsPage.jsx";
import { ElderlyWellnessPage } from "./pages/elderly/ElderlyWellnessPage.jsx";
import { WellnessReportDetailPage } from "./pages/wellness/WellnessReportDetailPage.jsx";

/**
 * Declares public and role-protected application routes.
 * @param {void} _unused - This component accepts no props.
 * @returns {import("react").ReactElement} Router route tree.
 * @sideEffects React Router may redirect based on route and session state.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage initialMode="family" />} />
      <Route path="/caregiver/signup" element={<SignupPage initialMode="caregiver" />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route element={<ProtectedRoute roles={["family"]} />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/elderly-profiles/new" element={<CreateElderlyProfilePage />} />
        <Route path="/elderly-profiles" element={<ElderlyProfileListPage />} />
      </Route>
      <Route element={<ProtectedRoute roles={["family"]} requireOnboarding />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/caregivers" element={<CaregiverBrowsePage />} />
        <Route path="/bookings" element={<FamilyBookingsPage />} />
        <Route
          path="/elderly-profiles/:profileId"
          element={<ElderlyProfileDetailPage />}
        />
        <Route
          path="/elderly-profiles/:profileId/edit"
          element={<EditElderlyProfilePage />}
        />
        <Route
          path="/elderly-profiles/:profileId/wellness"
          element={<ElderlyWellnessPage />}
        />
        <Route
          path="/elderly-profiles/:profileId/wellness-reports/:reportId"
          element={<WellnessReportDetailPage />}
        />
      </Route>
      <Route element={<ProtectedRoute roles={["admin"]} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverviewPage />} />
          <Route path="accounts" element={<AdminAccountsPage />} />
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
            <Route path="/caregiver/profile" element={<CaregiverProfilePage />} />
            <Route path="/caregiver/bookings" element={<CaregiverBookingsPage />} />
            <Route
              path="/caregiver/wellness-reports"
              element={<WellnessReportListPage />}
            />
            <Route
              path="/caregiver/wellness-reports/new"
              element={<WellnessReportEditorPage />}
            />
            <Route
              path="/caregiver/wellness-reports/:reportId/edit"
              element={<WellnessReportEditorPage />}
            />
            <Route
              path="/caregiver/wellness-reports/:reportId"
              element={<WellnessReportDetailPage />}
            />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
