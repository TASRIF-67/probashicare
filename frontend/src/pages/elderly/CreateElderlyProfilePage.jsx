import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader.jsx";
import { ProfileForm } from "../../components/elderly/ProfileForm.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { normalizeApiError } from "../../services/api.js";
import { elderlyProfileService } from "../../services/elderlyProfileService.js";

/**
 * Creates the first or an additional elderly profile for a family.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Profile creation workflow.
 * @sideEffects Creates profile/link records, refreshes auth state, and navigates to details.
 */
export function CreateElderlyProfilePage() {
  // 'useState(false)' asks React to remember whether the form is submitting.
  // The first returned value is current state; the second function changes it.
  const [isSubmitting, setIsSubmitting] = useState(false);
  // This state object stores server validation messages by field name.
  const [errors, setErrors] = useState({});
  const { refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  /**
   * Submits a complete new profile.
   * @param {Record<string, unknown>} value - Multi-step profile form data.
   * @returns {Promise<void>}
   * @sideEffects Calls create and auth APIs, shows feedback, and changes route.
   */
  async function handleCreate(value) {
    setIsSubmitting(true);
    setErrors({});
    try {
      // 'await' pauses until the backend creates both profile and owner link.
      const data = await elderlyProfileService.createProfile(value);
      const profile = data.profile;

      // Refreshing auth updates hasLinkedElderlyProfiles after first-profile creation.
      await refreshUser();
      showToast("Elderly profile created.", "success");
      navigate(`/elderly-profiles/${profile._id}`, { replace: true });
    } catch (error) {
      // normalizeApiError converts Axios/network errors into the app's standard shape.
      const normalized = normalizeApiError(error);
      const fieldErrors = normalized.details || {};

      setErrors({
        ...fieldErrors,
        form: normalized.message,
      });
    } finally {
      // 'finally' runs after either success or failure, so the button always unlocks.
      setIsSubmitting(false);
    }
  }

  return (
    <main>
      <AppHeader />
      <div className="feature-page">
        <div className="page-heading">
          <span className="eyebrow">Health Core</span>
          <h1>Create an elderly profile</h1>
          <p>Build a clear, private health overview for your relative.</p>
        </div>
        <ProfileForm
          onSubmit={handleCreate}
          isSubmitting={isSubmitting}
          errors={errors}
        />
      </div>
    </main>
  );
}
