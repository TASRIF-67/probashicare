import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute.jsx";
import { AdminLayout } from "./components/admin/AdminLayout.jsx";
import { DashboardPage } from "./pages/DashboardPage.jsx";
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
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route element={<ProtectedRoute roles={["family"]} />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/elderly-profiles/new" element={<CreateElderlyProfilePage />} />
        <Route path="/elderly-profiles" element={<ElderlyProfileListPage />} />
      </Route>
      <Route element={<ProtectedRoute roles={["family"]} requireOnboarding />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/elderly-profiles/:profileId" element={<ElderlyProfileDetailPage />} />
        <Route path="/elderly-profiles/:profileId/edit" element={<EditElderlyProfilePage />} />
      </Route>
      <Route element={<ProtectedRoute roles={["admin"]} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverviewPage />} />
          <Route path="accounts" element={<AdminAccountsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
