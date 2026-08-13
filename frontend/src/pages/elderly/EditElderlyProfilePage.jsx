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
  const { profileId } = useParams();
  const [profile, setProfile] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    /**
     * Loads the profile that will be edited.
     * @returns {Promise<void>}
     * @sideEffects Reads the profile API and updates page state.
     */
    async function loadProfile() {
      try {
        const data = await elderlyProfileService.getProfile(profileId);
        setProfile(data.profile);
      } catch (error) {
        const normalizedError = normalizeApiError(error);

        setErrors({
          load: normalizedError.message,
        });
      }
    }

    loadProfile();
  }, [profileId]);

  /**
   * Replaces the current editable profile data.
   * @param {Record<string, unknown>} value - Complete form data.
   * @returns {Promise<void>}
   * @sideEffects Calls update API, displays feedback, and changes route.
   */
  async function handleUpdate(value) {
    setIsSubmitting(true);
    setErrors({});
    try {
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
