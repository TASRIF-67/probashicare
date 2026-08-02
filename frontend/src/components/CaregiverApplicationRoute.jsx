import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const STATUS_DESTINATIONS = {
  draft: "/caregiver/application",
  rejected: "/caregiver/application",
  submitted: "/caregiver/application-status",
  approved: "/caregiver/dashboard",
  suspended: "/caregiver/application-status",
};

/**
 * Centralizes caregiver routing based on the current application status.
 * @param {{allowedStatuses: string[]}} props - Statuses permitted in the nested route.
 * @returns {import("react").ReactElement} Nested route or canonical status redirect.
 * @sideEffects Redirects through React Router when application state does not match.
 */
export function CaregiverApplicationRoute({ allowedStatuses }) {
  const { user } = useAuth();
  const status = user?.caregiverApplicationStatus || "draft";
  if (!allowedStatuses.includes(status)) {
    return <Navigate to={STATUS_DESTINATIONS[status] || "/caregiver/application"} replace />;
  }
  return <Outlet />;
}
