import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CaregiverApplicationForm } from "../../components/caregiver/CaregiverApplicationForm.jsx";
import { CaregiverHeader } from "../../components/caregiver/CaregiverHeader.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { normalizeApiError } from "../../services/api.js";
import { caregiverService } from "../../services/caregiverService.js";

/**
 * Loads and manages draft or rejected caregiver applications.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Editable caregiver application route.
 * @sideEffects Reads/saves/uploads/submits application data and refreshes authentication state.
 */
export function CaregiverApplicationPage() {
  const [application, setApplication] = useState(null);
  const [errors, setErrors] = useState({});
  const [isBusy, setIsBusy] = useState(false);
  const { refreshUser } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    caregiverService.getApplication().then(({ application: result }) => setApplication(result)).catch((error) => setErrors({ load: normalizeApiError(error).message }));
  }, []);

  /**
   * Uploads a selected document and returns the resulting application.
   * @param {File|null} file - Optional document selected in the form.
   * @param {object} fallbackApplication - Application to return when no upload is needed.
   * @returns {Promise<object>} Application with latest document state.
   * @sideEffects May upload a file to Cloudinary and update MongoDB.
   */
  async function uploadIfSelected(file, fallbackApplication) {
    if (!file) return fallbackApplication;
    const uploaded = await caregiverService.uploadDocument(file);
    setApplication(uploaded.application);
    return uploaded.application;
  }

  /**
   * Saves editable fields as a draft and optionally uploads a selected document.
   * @param {object} value - Application form values.
   * @param {File|null} file - Optional verification document.
   * @returns {Promise<void>}
   * @sideEffects Writes the draft, may upload to Cloudinary, and displays feedback.
   */
  async function handleSaveDraft(value, file) {
    setIsBusy(true);
    setErrors({});
    try {
      const saved = await caregiverService.saveDraft(value);
      const latest = await uploadIfSelected(file, saved.application);
      setApplication(latest);
      showToast(file ? "Draft and document saved." : "Application draft saved.", "success");
    } catch (error) {
      const normalized = normalizeApiError(error);
      setErrors({ ...(normalized.details || {}), form: normalized.message });
    } finally {
      setIsBusy(false);
    }
  }

  /**
   * Uploads any selected document and submits the complete application.
   * @param {object} value - Complete application form values.
   * @param {File|null} file - Optional newly selected verification document.
   * @returns {Promise<void>}
   * @sideEffects May upload, submits for review, refreshes auth, and navigates.
   */
  async function handleSubmitApplication(value, file) {
    setIsBusy(true);
    setErrors({});
    try {
      await uploadIfSelected(file, application);
      await caregiverService.submitApplication(value);
      await refreshUser();
      showToast("Application submitted for review.", "success");
      navigate("/caregiver/application-status", { replace: true });
    } catch (error) {
      const normalized = normalizeApiError(error);
      setErrors({ ...(normalized.details || {}), form: normalized.message });
    } finally {
      setIsBusy(false);
    }
  }

  if (errors.load) return <main><CaregiverHeader /><div className="center-page"><h1>Application unavailable</h1><p>{errors.load}</p></div></main>;
  if (!application) return <main><CaregiverHeader /><div className="page-loader"><span className="spinner" /> Loading application</div></main>;
  return <main><CaregiverHeader /><div className="caregiver-page"><div className="page-heading"><span className="eyebrow">Caregiver verification</span><h1>{application.applicationStatus === "rejected" ? "Update and resubmit" : "Complete your application"}</h1><p>{application.isVerificationDocumentRequired ? "Save your progress at any time. All required fields and a verification document are needed for submission." : "Save your progress at any time. Complete the required profile fields; document upload is optional during the current development phase."}</p></div>{application.applicationStatus === "rejected" && <div className="rejection-banner"><strong>Changes requested by the reviewer</strong><p>{application.rejectionReason}</p></div>}<CaregiverApplicationForm application={application} errors={errors} isBusy={isBusy} onSaveDraft={handleSaveDraft} onSubmitApplication={handleSubmitApplication} /></div></main>;
}
