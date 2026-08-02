import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

/**
 * Gates nested routes by session, onboarding state, and optional roles.
 * @param {{roles?: string[], requireOnboarding?: boolean}} props - Allowed roles and whether linked elderly profiles are required.
 * @returns {import("react").ReactElement} Nested route, loading view, or redirect.
 * @sideEffects Redirects through React Router when access requirements are unmet.
 */
export function ProtectedRoute({ roles = [], requireOnboarding = false }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="page-loader"><span className="spinner" /> Restoring your session</div>;
  }
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (roles.length && !roles.includes(user.role)) return <Navigate to="/unauthorized" replace />;
  if (requireOnboarding && user.role === "family" && !user.hasLinkedElderlyProfiles) {
    return <Navigate to="/onboarding" replace />;
  }
  return <Outlet />;
}
