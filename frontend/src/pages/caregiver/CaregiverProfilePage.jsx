import { useEffect, useState } from "react";
import { CaregiverApplicationForm } from "../../components/caregiver/CaregiverApplicationForm.jsx";
import { CaregiverHeader } from "../../components/caregiver/CaregiverHeader.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { normalizeApiError } from "../../services/api.js";
import { caregiverService } from "../../services/caregiverService.js";

/**
 * Lets approved caregivers update ordinary profile and availability fields.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Approved profile editor.
 * @sideEffects Loads and updates caregiver profile data without re-review.
 */
export function CaregiverProfilePage() {
  const [application, setApplication] = useState(null);
  const [errors, setErrors] = useState({});
  const [isBusy, setIsBusy] = useState(false);
  const { showToast } = useToast();
  useEffect(() => { caregiverService.getApplication().then(({ application: result }) => setApplication(result)).catch((error) => setErrors({ load: normalizeApiError(error).message })); }, []);

  /**
   * Saves approved caregiver profile fields without changing review state.
   * @param {object} value - Complete editable caregiver values.
   * @returns {Promise<void>}
   * @sideEffects Calls profile update API and displays feedback.
   */
  async function handleUpdate(value) {
    setIsBusy(true);
    setErrors({});
    try {
      const data = await caregiverService.updateApprovedProfile(value);
      setApplication(data.application);
      showToast("Caregiver profile updated.", "success");
    } catch (error) {
      const normalized = normalizeApiError(error);
      setErrors({ ...(normalized.details || {}), form: normalized.message });
    } finally {
      setIsBusy(false);
    }
  }

  if (errors.load) return <main><CaregiverHeader /><div className="center-page"><h1>Profile unavailable</h1><p>{errors.load}</p></div></main>;
  if (!application) return <main><CaregiverHeader /><div className="page-loader"><span className="spinner" /> Loading profile</div></main>;
  return <main><CaregiverHeader /><div className="caregiver-page"><div className="page-heading"><span className="eyebrow">Professional profile</span><h1>Manage your caregiver profile</h1><p>Rate and availability changes do not require another initial review.</p></div><CaregiverApplicationForm application={application} errors={errors} isBusy={isBusy} approvedMode onUpdateApproved={handleUpdate} /></div></main>;
}
