import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/Card.jsx";
import { CaregiverHeader } from "../../components/caregiver/CaregiverHeader.jsx";
import { ArrowRightIcon, ClipboardListIcon, PlusIcon } from "../../components/Icons.jsx";
import { normalizeApiError } from "../../services/api.js";
import { wellnessReportService } from "../../services/wellnessReportService.js";

/**
 * Formats one stored report date for compact caregiver history display.
 * @param {string|Date} value - Stored date value.
 * @returns {string} Localized medium date.
 * @sideEffects None.
 */
function formatDate(value) {
  const dateFormatter = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  });

  return dateFormatter.format(new Date(value));
}

const STATUS_FILTERS = [
  {
    value: "",
    label: "All",
  },
  {
    value: "draft",
    label: "Drafts",
  },
  {
    value: "submitted",
    label: "Submitted",
  },
];

/**
 * Lists current caregiver drafts and submitted wellness reports.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Filterable caregiver report history.
 * @sideEffects Loads caregiver-owned reports whenever the status filter changes.
 */
export function WellnessReportListPage() {
  const [status, setStatus] = useState("");
  const [state, setState] = useState({ loading: true, reports: [], error: "" });

  useEffect(() => {
    /**
     * Loads the reports matching the selected status.
     * @returns {Promise<void>}
     * @sideEffects Reads the wellness API and updates page state.
     */
    async function loadReports() {
      setState((current) => {
        return {
          ...current,
          loading: true,
          error: "",
        };
      });

      const options = {};

      if (status) {
        options.status = status;
      }

      try {
        const data = await wellnessReportService.listMyReports(options);

        setState({
          loading: false,
          reports: data.reports,
          error: "",
        });
      } catch (error) {
        const normalizedError = normalizeApiError(error);

        setState({
          loading: false,
          reports: [],
          error: normalizedError.message,
        });
      }
    }

    loadReports();
  }, [status]);

  /**
   * Changes the active report-status filter.
   * @param {string} nextStatus - Empty, draft, or submitted status value.
   * @returns {void}
   * @sideEffects Updates local filter state and triggers report reloading.
   */
  function handleStatusChange(nextStatus) {
    setStatus(nextStatus);
  }

  return (
    <main>
      <CaregiverHeader />
      <div className="caregiver-page">
        <div className="page-heading page-heading--action"><div><span className="eyebrow">Care records</span><h1>Wellness reports</h1><p>Prepare structured visit updates and review reports already shared with families.</p></div><Link className="button button--primary" to="/caregiver/wellness-reports/new"><PlusIcon size={18} /> New report</Link></div>
        <div className="wellness-toolbar" role="group" aria-label="Report status filter">{[{ value: "", label: "All" }, { value: "draft", label: "Drafts" }, { value: "submitted", label: "Submitted" }].map((option) => <button type="button" className={status === option.value ? "wellness-filter wellness-filter--active" : "wellness-filter"} onClick={() => setStatus(option.value)} key={option.value}>{option.label}</button>)}</div>
        {state.loading && <div className="page-loader-inline"><span className="spinner" /> Loading reports</div>}
        {state.error && <div className="alert alert--error">{state.error}</div>}
        {!state.loading && !state.reports.length && <Card className="wellness-empty"><span className="feature-icon"><ClipboardListIcon /></span><h2>No reports in this view</h2><p>Reports will appear here after you save a draft or submit a visit update.</p></Card>}
        <div className="wellness-report-list">{state.reports.map((report) => <Link className="wellness-report-row" to={report.status === "draft" ? `/caregiver/wellness-reports/${report._id}/edit` : `/caregiver/wellness-reports/${report._id}`} key={report._id}><span className="profile-avatar">{report.elderly?.preferredName?.[0] || report.elderly?.fullName?.[0] || "E"}</span><div><span className="wellness-report-row__date">{formatDate(report.visitDate)}</span><h2>{report.elderly?.preferredName || report.elderly?.fullName || "Elderly profile"}</h2><p>{report.observations || "Report details are still being prepared."}</p></div><span className={`status-badge ${report.status === "submitted" ? "status-badge--success" : ""}`}>{report.status}</span><ArrowRightIcon size={19} /></Link>)}</div>
      </div>
    </main>
  );
}
