import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../components/Button.jsx";
import { Card } from "../../components/Card.jsx";
import { ArrowRightIcon, BriefcaseIcon, RefreshIcon, SearchIcon } from "../../components/Icons.jsx";
import { adminService } from "../../services/adminService.js";
import { normalizeApiError } from "../../services/api.js";

const STATUS_OPTIONS = ["submitted", "approved", "rejected", "draft", "all"];

/**
 * Formats an application timestamp for the admin queue.
 * @param {string|Date|null} value - Stored application timestamp.
 * @returns {string} Localized date or `Not submitted` when absent.
 * @sideEffects None.
 */
function formatDate(value) {
  if (!value) return "Not submitted";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

/**
 * Converts a machine application status into a readable label.
 * @param {string} status - Caregiver application status.
 * @returns {string} Title-cased status text.
 * @sideEffects None.
 */
function formatStatus(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/**
 * Renders the administrator caregiver application queue and filters.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Searchable application queue.
 * @sideEffects Loads caregiver applications whenever the status filter changes.
 */
export function AdminCaregiverApplicationsPage() {
  const [status, setStatus] = useState("submitted");
  const [applications, setApplications] = useState([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  /**
   * Loads applications matching the selected review status.
   * @param {string} selectedStatus - Status sent to the admin list API.
   * @returns {Promise<void>}
   * @sideEffects Calls the API and replaces queue state.
   */
  async function loadApplications(selectedStatus) {
    setIsLoading(true);
    setError("");
    try {
      const data = await adminService.listCaregiverApplications(selectedStatus);
      setApplications(data.applications);
    } catch (requestError) {
      setError(normalizeApiError(requestError).message);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadApplications(status);
  }, [status]);

  const normalizedSearch = search.trim().toLowerCase();
  const visibleApplications = applications.filter((application) => {
    if (!normalizedSearch) return true;
    return [application.user?.name, application.user?.email, application.phone, application.serviceArea]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(normalizedSearch));
  });

  return (
    <>
      <div className="admin-heading">
        <div><span className="eyebrow">Care network</span><h1>Caregiver applications</h1><p>Review credentials and professional details before granting platform access.</p></div>
        <Button variant="secondary" onClick={() => loadApplications(status)} isLoading={isLoading}><RefreshIcon size={18} /> Refresh data</Button>
      </div>
      <Card className="caregiver-review-panel">
        <div className="review-toolbar">
          <div className="review-status-tabs" aria-label="Filter caregiver applications">
            {STATUS_OPTIONS.map((option) => <button className={status === option ? "review-status-tab review-status-tab--active" : "review-status-tab"} type="button" onClick={() => setStatus(option)} key={option}>{formatStatus(option)}</button>)}
          </div>
          <label className="admin-search">
            <SearchIcon size={18} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search caregiver applications" placeholder="Search caregiver, email, or area" />
          </label>
        </div>
        {error && <div className="alert alert--error">{error}</div>}
        {isLoading ? <div className="page-loader-inline"><span className="spinner" /> Loading applications</div> : (
          <div className="caregiver-review-list">
            {!visibleApplications.length && <div className="empty-state"><BriefcaseIcon /><h2>No matching applications</h2><p>There are no caregiver records for this filter yet.</p></div>}
            {visibleApplications.map((application) => (
              <Link className="caregiver-review-row" to={`/admin/caregivers/${application._id}`} key={application._id}>
                <span className="profile-avatar">{application.user?.name?.[0] || "C"}</span>
                <span className="caregiver-review-row__identity"><strong>{application.user?.name || "Caregiver account"}</strong><small>{application.user?.email}</small></span>
                <span><small>Experience</small><strong>{application.yearsOfExperience ?? 0} years</strong></span>
                <span><small>Service area</small><strong>{application.serviceArea || "Not provided"}</strong></span>
                <span className={`status-badge status-badge--${application.applicationStatus}`}>{formatStatus(application.applicationStatus)}</span>
                <time dateTime={application.submittedAt || application.updatedAt}>{formatDate(application.submittedAt)}</time>
                <ArrowRightIcon size={18} />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

