import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../../components/Button.jsx";
import { Card } from "../../components/Card.jsx";
import { ArrowLeftIcon, BadgeCheckIcon, FileCheckIcon, MapPinIcon, MoneyIcon, ShieldCheckIcon } from "../../components/Icons.jsx";
import { Modal } from "../../components/Modal.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { adminService } from "../../services/adminService.js";
import { normalizeApiError } from "../../services/api.js";

/**
 * Formats BDT rate values for the review screen.
 * @param {number|null|undefined} value - Stored monetary rate.
 * @returns {string} Currency text or `Not provided`.
 * @sideEffects None.
 */
function formatRate(value) {
  if (value === null || value === undefined) return "Not provided";
  return `${new Intl.NumberFormat("en-BD").format(value)} BDT`;
}

/**
 * Formats a weekday value for display.
 * @param {string} day - Lowercase weekday.
 * @returns {string} Title-cased weekday.
 * @sideEffects None.
 */
function formatDay(day) {
  return day.charAt(0).toUpperCase() + day.slice(1);
}

/**
 * Renders a complete administrator review for one caregiver application.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Application evidence and review controls.
 * @sideEffects Loads the application and may approve or reject it.
 */
export function AdminCaregiverReviewPage() {
  const { profileId } = useParams();
  const [application, setApplication] = useState(null);
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [reviewAction, setReviewAction] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    adminService.getCaregiverApplication(profileId)
      .then(({ application: result }) => setApplication(result))
      .catch((requestError) => setError(normalizeApiError(requestError).message));
  }, [profileId]);

  /**
   * Approves the loaded submitted application after confirmation.
   * @param {void} _unused - Uses the current route profile ID.
   * @returns {Promise<void>}
   * @sideEffects Writes approval state, displays feedback, and returns to the queue.
   */
  async function handleApprove() {
    setIsBusy(true);
    setError("");
    try {
      await adminService.approveCaregiverApplication(profileId);
      showToast("Caregiver application approved.", "success");
      navigate("/admin/caregivers", { replace: true });
    } catch (requestError) {
      setError(normalizeApiError(requestError).message);
      setReviewAction(null);
    } finally {
      setIsBusy(false);
    }
  }

  /**
   * Rejects the loaded submitted application with actionable feedback.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Rejection form submission.
   * @returns {Promise<void>}
   * @sideEffects Writes rejection state, displays feedback, and returns to the queue.
   */
  async function handleReject(event) {
    event.preventDefault();
    if (!rejectionReason.trim()) {
      setReasonError("Enter a reason the caregiver can act on.");
      return;
    }
    setIsBusy(true);
    setReasonError("");
    try {
      await adminService.rejectCaregiverApplication(profileId, rejectionReason);
      showToast("Application returned for changes.", "success");
      navigate("/admin/caregivers", { replace: true });
    } catch (requestError) {
      const normalized = normalizeApiError(requestError);
      setReasonError(normalized.details?.reason || normalized.message);
    } finally {
      setIsBusy(false);
    }
  }

  if (error && !application) return <div className="center-page"><h1>Application unavailable</h1><p>{error}</p><Link to="/admin/caregivers">Return to applications</Link></div>;
  if (!application) return <div className="page-loader-inline"><span className="spinner" /> Loading caregiver application</div>;

  const isReviewable = application.applicationStatus === "submitted";
  return (
    <>
      <div className="review-page-heading">
        <Link className="button button--secondary" to="/admin/caregivers"><ArrowLeftIcon size={17} /> Applications</Link>
        <div><span className="eyebrow">Credential review</span><h1>{application.user?.name}</h1><p>{application.user?.email} · {application.phone}</p></div>
        <span className={`status-badge status-badge--${application.applicationStatus}`}>{application.applicationStatus}</span>
      </div>
      {error && <div className="alert alert--error">{error}</div>}
      {application.rejectionReason && <div className="rejection-banner"><strong>Previous review feedback</strong><p>{application.rejectionReason}</p></div>}
      <div className="admin-review-grid">
        <div className="admin-review-main">
          <Card className="review-detail-card"><div className="review-detail-card__heading"><span><ShieldCheckIcon /></span><div><h2>Professional background</h2><p>Information supplied by the caregiver.</p></div></div><p className="review-bio">{application.bio || "No bio provided."}</p><dl className="review-detail-grid"><div><dt>Years of experience</dt><dd>{application.yearsOfExperience ?? "Not provided"}</dd></div><div><dt>Service area</dt><dd><MapPinIcon size={15} /> {application.serviceArea || "Not provided"}</dd></div><div><dt>Hourly rate</dt><dd>{formatRate(application.hourlyRate)}</dd></div><div><dt>Monthly rate</dt><dd>{formatRate(application.monthlyRate)}</dd></div></dl><div className="review-tag-group"><div><small>Skills</small><div>{application.skills?.map((skill) => <span className="review-tag" key={skill}>{skill}</span>)}</div></div><div><small>Languages</small><div>{application.languages?.map((language) => <span className="review-tag" key={language}>{language}</span>)}</div></div></div></Card>
          <Card className="review-detail-card"><div className="review-detail-card__heading"><span><BadgeCheckIcon /></span><div><h2>Weekly availability</h2><p>Normal working periods provided with the application.</p></div></div><div className="review-availability">{application.availability?.map((entry, index) => <div key={entry._id || index}><strong>{formatDay(entry.day)}</strong><span>{entry.startTime}–{entry.endTime}</span></div>)}</div></Card>
        </div>
        <aside className="admin-review-sidebar">
          <Card className="review-document-card"><span className="feature-icon"><FileCheckIcon /></span><h2>Verification document</h2><p>{application.verificationDocument?.originalName || "No document supplied"}</p>{application.verificationDocument?.accessUrl ? <a className="button button--secondary" href={application.verificationDocument.accessUrl} target="_blank" rel="noreferrer">Open secure document</a> : <div className="document-warning">A secure preview is unavailable until Cloudinary credentials are configured.</div>}</Card>
          <Card className="review-decision-card"><span className="feature-icon"><MoneyIcon /></span><h2>Review decision</h2>{isReviewable ? <><p>Confirm that identity evidence and professional details are acceptable.</p><Button onClick={() => setReviewAction("approve")}><BadgeCheckIcon size={18} /> Approve application</Button><Button variant="secondary" onClick={() => setReviewAction("reject")}>Request changes</Button></> : <p>This application has already been {application.applicationStatus}.</p>}</Card>
        </aside>
      </div>
      <Modal isOpen={reviewAction === "approve"} title="Approve caregiver application?" onClose={() => setReviewAction(null)}><p>This grants the caregiver access to their operational dashboard and future booking tools.</p><div className="modal-actions"><Button variant="secondary" onClick={() => setReviewAction(null)}>Cancel</Button><Button isLoading={isBusy} onClick={handleApprove}><BadgeCheckIcon size={17} /> Approve caregiver</Button></div></Modal>
      <Modal isOpen={reviewAction === "reject"} title="Request application changes" onClose={() => setReviewAction(null)}><form onSubmit={handleReject}><label className="field"><span>Reason for rejection</span><textarea className={reasonError ? "input textarea input--error" : "input textarea"} value={rejectionReason} onChange={(event) => { setRejectionReason(event.target.value); setReasonError(""); }} maxLength="1000" placeholder="Explain what must be corrected before resubmission" autoFocus />{reasonError && <small className="field__error">{reasonError}</small>}</label><div className="modal-actions"><Button type="button" variant="secondary" onClick={() => setReviewAction(null)}>Cancel</Button><Button type="submit" isLoading={isBusy}>Send feedback</Button></div></form></Modal>
    </>
  );
}

