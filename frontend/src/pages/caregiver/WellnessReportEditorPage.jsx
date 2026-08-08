import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../../components/Button.jsx";
import { CaregiverHeader } from "../../components/caregiver/CaregiverHeader.jsx";
import { ArrowLeftIcon, ClipboardListIcon, SendIcon } from "../../components/Icons.jsx";
import { Modal } from "../../components/Modal.jsx";
import { WellnessReportForm } from "../../components/wellness/WellnessReportForm.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { normalizeApiError } from "../../services/api.js";
import { wellnessReportService } from "../../services/wellnessReportService.js";

/**
 * Creates or edits a caregiver wellness-report draft and confirms final submission.
 * @param {void} _unused - Route params provide the optional report identifier.
 * @returns {import("react").ReactElement} Caregiver report editor with confirmation modal.
 * @sideEffects Loads assignments/report data, writes drafts, submits reports, shows toasts, and navigates.
 */
export function WellnessReportEditorPage() {
  const { reportId } = useParams();
  const [state, setState] = useState({ loading: true, assignments: [], report: null, error: "" });
  const [errors, setErrors] = useState({});
  const [isBusy, setIsBusy] = useState(false);
  const [pendingSubmission, setPendingSubmission] = useState(null);
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      wellnessReportService.listAssignments(),
      reportId ? wellnessReportService.getReport(reportId) : Promise.resolve({ report: null }),
    ])
      .then(([assignmentData, reportData]) => {
        if (reportData.report?.status === "submitted") {
          navigate(`/caregiver/wellness-reports/${reportData.report._id}`, { replace: true });
          return;
        }
        setState({
          loading: false,
          assignments: assignmentData.assignments,
          report: reportData.report,
          error: "",
        });
      })
      .catch((error) => setState((current) => ({ ...current, loading: false, error: normalizeApiError(error).message })));
  }, [navigate, reportId]);

  /**
   * Persists the supplied values as a new or existing draft without managing busy state.
   * @param {Record<string, unknown>} values - Complete report form values.
   * @returns {Promise<object>} Created or updated report draft.
   * @sideEffects Calls the report API and updates local report state.
   */
  async function persistDraft(values) {
    const data = state.report
      ? await wellnessReportService.updateDraft(state.report._id, values)
      : await wellnessReportService.createReport(values);
    setState((current) => ({ ...current, report: data.report }));
    return data.report;
  }

  /**
   * Saves the current form as a draft and moves a new report onto its edit URL.
   * @param {Record<string, unknown>} values - Complete report form values.
   * @returns {Promise<void>}
   * @sideEffects Writes a report, displays feedback, and may replace the browser route.
   */
  async function handleSaveDraft(values) {
    setIsBusy(true);
    setErrors({});
    try {
      const report = await persistDraft(values);
      showToast("Wellness report draft saved.", "success");
      if (!reportId) navigate(`/caregiver/wellness-reports/${report._id}/edit`, { replace: true });
    } catch (error) {
      const normalized = normalizeApiError(error);
      setErrors({ ...(normalized.details || {}), form: normalized.message });
    } finally {
      setIsBusy(false);
    }
  }

  /**
   * Stores current values until the caregiver confirms irreversible submission.
   * @param {Record<string, unknown>} values - Complete report form values.
   * @returns {void}
   * @sideEffects Opens the submission confirmation modal.
   */
  function handleRequestSubmit(values) {
    setPendingSubmission(values);
  }

  /**
   * Saves the latest form, submits it, and opens the read-only report detail.
   * @param {void} _unused - Uses values captured before opening the modal.
   * @returns {Promise<void>}
   * @sideEffects Writes and submits a report, shows feedback, closes the modal, and navigates.
   */
  async function handleConfirmSubmit() {
    setIsBusy(true);
    setErrors({});
    try {
      const draft = await persistDraft(pendingSubmission);
      await wellnessReportService.submitReport(draft._id);
      setPendingSubmission(null);
      showToast("Wellness report submitted to the family.", "success");
      navigate(`/caregiver/wellness-reports/${draft._id}`, { replace: true });
    } catch (error) {
      const normalized = normalizeApiError(error);
      setErrors({ ...(normalized.details || {}), form: normalized.message });
      setPendingSubmission(null);
    } finally {
      setIsBusy(false);
    }
  }

  if (state.loading) return <main><CaregiverHeader /><div className="page-loader"><span className="spinner" /> Loading report editor</div></main>;
  if (state.error) return <main><CaregiverHeader /><div className="center-page"><h1>Report unavailable</h1><p>{state.error}</p><Link className="button button--secondary" to="/caregiver/wellness-reports"><ArrowLeftIcon size={18} /> Return to reports</Link></div></main>;

  return (
    <main>
      <CaregiverHeader />
      <div className="caregiver-page wellness-editor-page">
        <Link className="profile-back-link" to="/caregiver/wellness-reports"><ArrowLeftIcon size={17} /> Wellness reports</Link>
        <div className="page-heading"><span className="eyebrow">Daily care record</span><h1>{state.report ? "Continue wellness report" : "Create wellness report"}</h1><p>Save an incomplete visit as a draft. Once submitted, the report becomes read-only and visible to linked family members.</p></div>
        {!state.assignments.length ? <div className="wellness-no-assignment"><span><ClipboardListIcon /></span><h2>No reportable care visits</h2><p>An active or recently completed caregiver assignment is required before a report can be created.</p></div> : <WellnessReportForm report={state.report} assignments={state.assignments} errors={errors} isBusy={isBusy} onSaveDraft={handleSaveDraft} onRequestSubmit={handleRequestSubmit} />}
      </div>
      <Modal isOpen={Boolean(pendingSubmission)} title="Submit this wellness report?" onClose={() => setPendingSubmission(null)}>
        <p>Linked family members will be able to read it immediately. Submitted reports cannot be edited from the caregiver portal.</p>
        <div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setPendingSubmission(null)}>Continue editing</Button><Button type="button" isLoading={isBusy} onClick={handleConfirmSubmit}><SendIcon size={18} /> Submit report</Button></div>
      </Modal>
    </main>
  );
}
