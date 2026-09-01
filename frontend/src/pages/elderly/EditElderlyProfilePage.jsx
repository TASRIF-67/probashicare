import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader.jsx";
import { ProfileForm } from "../../components/elderly/ProfileForm.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { normalizeApiError } from "../../services/api.js";
import { elderlyProfileService } from "../../services/elderlyProfileService.js";

/**
 * Loads and updates every editable section of an elderly profile.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Profile edit workflow.
 * @sideEffects Loads and updates profile data and navigates after success.
 */
export function EditElderlyProfilePage() {
  // 'useParams()' reads the dynamic profileId part of the current URL.
  const { profileId } = useParams();
  const [profile, setProfile] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  // 'useEffect()' runs this loading work after React renders and whenever
  // profileId changes. The callback itself is not async; it calls an inner async function.
  useEffect(() => {
    /**
     * Loads the profile that will be edited.
     * @returns {Promise<void>}
     * @sideEffects Reads the profile API and updates page state.
     */
    async function loadProfile() {
      // Execution sequence:
      // 1. Request the authorized profile for the route ID.
      // 2. Store profile data or a normalized page error.
      // 3. End initial loading even when the request fails.
      try {
        // 'await' pauses until the authorized profile request finishes.
        const data = await elderlyProfileService.getProfile(profileId);
        setProfile(data.profile);
      } catch (error) {
        const normalizedError = normalizeApiError(error);

        setErrors({
          load: normalizedError.message,
        });
      }
    }

    // Calling the async function starts it. It returns a Promise, but the effect
    // itself returns nothing because React only accepts a cleanup function.
    loadProfile();
  }, [profileId]);

  /**
   * Replaces the current editable profile data.
   * @param {Record<string, unknown>} value - Complete form data.
   * @returns {Promise<void>}
   * @sideEffects Calls update API, displays feedback, and changes route.
   */
  async function handleUpdate(value) {
    // Execution sequence:
    // 1. Lock submission and clear stale errors.
    // 2. Save the complete validated form through the service.
    // 3. Navigate on success or map errors, then unlock submission.
    setIsSubmitting(true);
    setErrors({});
    try {
      // The service returns a Promise; 'await' keeps the page here until save finishes.
      await elderlyProfileService.updateProfile(profileId, value);
      showToast("Profile updated.", "success");
      navigate(`/elderly-profiles/${profileId}`);
    } catch (error) {
      const normalized = normalizeApiError(error);
      const fieldErrors = normalized.details || {};

      setErrors({
        ...fieldErrors,
        form: normalized.message,
      });
    } finally {
      // 'finally' runs for both success and error, restoring the submit button.
      setIsSubmitting(false);
    }
  }

  if (errors.load) {
    return (
      <main>
        <AppHeader />
        <div className="center-page">
          <h1>Profile unavailable</h1>
          <p>{errors.load}</p>
          <Link to="/elderly-profiles">Return to profiles</Link>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main>
        <AppHeader />
        <div className="page-loader">
          <span className="spinner" />
          Loading profile
        </div>
      </main>
    );
  }

  const personal = profile.personalInformation;
  const displayName = personal.preferredName || personal.fullName;

  return (
    <main>
      <AppHeader />
      <div className="feature-page">
        <div className="page-heading">
          <span className="eyebrow">Update record</span>
          <h1>Edit {displayName}</h1>
          <p>Review changes carefully before saving the health record.</p>
        </div>
        <ProfileForm
          initialProfile={profile}
          onSubmit={handleUpdate}
          isSubmitting={isSubmitting}
          errors={errors}
          submitLabel="Save changes"
        />
      </div>
    </main>
  );
}
