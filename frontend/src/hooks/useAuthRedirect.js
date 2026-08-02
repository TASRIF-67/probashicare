import { useNavigate } from "react-router-dom";

/**
 * Returns the correct post-login navigator for role and onboarding status.
 * @param {void} _unused - This hook accepts no arguments.
 * @returns {(user: {role: string, hasLinkedElderlyProfiles: boolean, caregiverApplicationStatus?: string}) => void} Redirect action.
 * @sideEffects Navigates to the role-appropriate admin, family, or caregiver route.
 */
export function useAuthRedirect() {
  const navigate = useNavigate();

  /**
   * Routes an authenticated user to the appropriate first screen.
   * @param {{role: string, hasLinkedElderlyProfiles: boolean, caregiverApplicationStatus?: string}} user - Public authenticated user.
   * @returns {void}
   * @sideEffects Changes the current client route.
   */
  return function redirectAfterLogin(user) {
    if (user.role === "admin") navigate("/admin", { replace: true });
    else if (user.role === "caregiver") {
      const caregiverDestinations = {
        draft: "/caregiver/application",
        rejected: "/caregiver/application",
        submitted: "/caregiver/application-status",
        approved: "/caregiver/dashboard",
        suspended: "/caregiver/application-status",
      };
      navigate(caregiverDestinations[user.caregiverApplicationStatus] || "/caregiver/application", {
        replace: true,
      });
    }
    else if (!user.hasLinkedElderlyProfiles) navigate("/onboarding", { replace: true });
    else navigate("/dashboard", { replace: true });
  };
}
