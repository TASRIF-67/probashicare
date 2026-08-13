import { useEffect, useState } from "react";
import { Button } from "../Button.jsx";
import { Card } from "../Card.jsx";
import { AlertIcon, CheckIcon, InsightsIcon } from "../Icons.jsx";
import { Modal } from "../Modal.jsx";
import { Pagination } from "../Pagination.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { normalizeApiError } from "../../services/api.js";
import { wellnessAlertService } from "../../services/wellnessAlertService.js";
import { wellnessInsightService } from "../../services/wellnessInsightService.js";

/** Formats a date for display. @param {string|Date|null} value - Date value. @returns {string} Localized date. @sideEffects None. */
function formatDate(value) {
  if (!value) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

/** Makes an enum readable. @param {string} value - Enum value. @returns {string} Display label. @sideEffects None. */
function humanize(value) {
  const text = String(value || "").replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Displays deterministic alerts and on-demand wellness insights.
 * @param {{profileId: string}} props - Authorized elderly profile ID.
 * @returns {import("react").ReactElement} Family insights interface.
 * @sideEffects Loads and updates alerts and may request a Gemini summary.
 */
export function WellnessInsightsPanel({ profileId }) {
  const { showToast } = useToast();
  const [alerts, setAlerts] = useState([]);
  const [alertPage, setAlertPage] = useState(1);
  const [alertPagination, setAlertPagination] = useState(null);
  const [alertSummary, setAlertSummary] = useState({ activeCount: 0, low: 0, medium: 0, high: 0 });
  const [filters, setFilters] = useState({ status: "", severity: "" });
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [alertError, setAlertError] = useState("");
  const [insight, setInsight] = useState(null);
  const [loadingInsight, setLoadingInsight] = useState(true);
  const [generatingInsight, setGeneratingInsight] = useState(false);
  const [insightError, setInsightError] = useState("");
  const [busyAlertId, setBusyAlertId] = useState("");
  const [resolvingAlert, setResolvingAlert] = useState(null);
  const [resolutionNote, setResolutionNote] = useState("");

  /**
   * Loads alerts using current filters.
   * @returns {Promise<void>}
   * @sideEffects Calls the alert API and updates state.
   */
  async function loadAlerts() {
    setLoadingAlerts(true);
    setAlertError("");
    const query = {
      page: alertPage,
      limit: 3,
    };

    if (filters.status) {
      query.status = filters.status;
    }
    if (filters.severity) {
      query.severity = filters.severity;
    }

    try {
      const data = await wellnessAlertService.listAlerts(profileId, query);
      setAlerts(data.alerts);
      setAlertPagination(data.pagination);
      setAlertSummary({
        activeCount: data.activeCount,
        low: data.severitySummary.low,
        medium: data.severitySummary.medium,
        high: data.severitySummary.high,
      });
    } catch (error) {
      setAlerts([]);
      setAlertPagination(null);
      setAlertError(normalizeApiError(error).message);
    } finally {
      setLoadingAlerts(false);
    }
  }

  useEffect(() => {
    loadAlerts();
  }, [alertPage, profileId, filters.status, filters.severity]);

  useEffect(() => {
    /**
     * Loads a saved insight without generating a new one.
     * @returns {Promise<void>}
     * @sideEffects Calls the latest-insight API.
     */
    async function loadInsight() {
      try {
        const data = await wellnessInsightService.getLatestInsight(profileId);
        setInsight(data.insight);
      } catch (error) {
        setInsightError(normalizeApiError(error).message);
      } finally {
        setLoadingInsight(false);
      }
    }

    loadInsight();
  }, [profileId]);

  /** Changes one list filter. @param {import("react").ChangeEvent<HTMLSelectElement>} event - Select event. @returns {void} @sideEffects Updates filters. */
  function changeFilter(event) {
    const { name, value } = event.target;
    setAlertPage(1);
    setFilters((current) => ({ ...current, [name]: value }));
  }

  /** Acknowledges one alert. @param {object} alert - Active alert. @returns {Promise<void>} @sideEffects Updates the API and list. */
  async function acknowledge(alert) {
    setBusyAlertId(alert._id);
    try {
      await wellnessAlertService.acknowledgeAlert(alert._id);
      showToast("Wellness alert acknowledged.", "success");
      await loadAlerts();
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    } finally {
      setBusyAlertId("");
    }
  }

  /** Opens resolution input. @param {object} alert - Selected alert. @returns {void} @sideEffects Opens modal. */
  function openResolve(alert) {
    setResolvingAlert(alert);
    setResolutionNote("");
  }

  /** Closes resolution input. @returns {void} @sideEffects Closes modal. */
  function closeResolve() {
    if (!busyAlertId) {
      setResolvingAlert(null);
      setResolutionNote("");
    }
  }

  /** Resolves the selected alert. @returns {Promise<void>} @sideEffects Updates the API and list. */
  async function resolve() {
    if (!resolvingAlert || resolutionNote.trim().length < 3) {
      return;
    }

    setBusyAlertId(resolvingAlert._id);
    try {
      await wellnessAlertService.resolveAlert(resolvingAlert._id, resolutionNote);
      showToast("Wellness alert resolved.", "success");
      setResolvingAlert(null);
      setResolutionNote("");
      await loadAlerts();
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    } finally {
      setBusyAlertId("");
    }
  }

  /** Requests a Gemini or fallback insight. @returns {Promise<void>} @sideEffects Calls generation API and updates state. */
  async function generate() {
    setGeneratingInsight(true);
    setInsightError("");
    try {
      const data = await wellnessInsightService.generateInsight(profileId);
      setInsight(data.insight);
      if (data.generatedBy === "fallback") {
        showToast("Gemini was unavailable. A rule-based summary was created.", "info");
      } else if (data.reused) {
        showToast("The saved summary is still current.", "success");
      } else {
        showToast("Wellness summary generated.", "success");
      }
    } catch (error) {
      setInsightError(normalizeApiError(error).message);
    } finally {
      setGeneratingInsight(false);
    }
  }

  return (
    <div className="wellness-insights">
      <section>
        <div className="wellness-section-heading">
          <div>
            <span><AlertIcon /></span>
            <div>
              <h2>Early wellness alerts</h2>
              <p>Rule-based informational screening, not a diagnosis.</p>
            </div>
          </div>
        </div>
        <div className="wellness-alert-summary">
          <Card><strong>{alertSummary.activeCount}</strong><span>Open alerts</span></Card>
          <Card><strong>{alertSummary.high}</strong><span>High</span></Card>
          <Card><strong>{alertSummary.medium}</strong><span>Medium</span></Card>
          <Card><strong>{alertSummary.low}</strong><span>Low</span></Card>
        </div>
        <div className="wellness-alert-filters">
          <label className="field">
            <span>Status</span>
            <select className="input" name="status" value={filters.status} onChange={changeFilter}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="acknowledged">Acknowledged</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
          <label className="field">
            <span>Severity</span>
            <select className="input" name="severity" value={filters.severity} onChange={changeFilter}>
              <option value="">All severities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
        </div>
        {loadingAlerts && <div className="page-loader-inline"><span className="spinner" /> Loading alerts</div>}
        {alertError && <div className="alert alert--error">{alertError}</div>}
        {!loadingAlerts && !alerts.length && <Card className="wellness-empty"><AlertIcon /><h3>No alerts in this view</h3><p>No recent pattern matches these filters.</p></Card>}
        <div className="wellness-alert-list">
          {alerts.map((alert) => (
            <Card className={"wellness-alert-card wellness-alert-card--" + alert.severity} key={alert._id}>
              <div className="wellness-alert-card__heading">
                <div><span className="eyebrow">{humanize(alert.category)}</span><h3>{alert.title}</h3></div>
                <div><span className={"severity-badge severity-badge--" + alert.severity}>{humanize(alert.severity)}</span><span className="status-badge">{humanize(alert.status)}</span></div>
              </div>
              <p>{alert.message}</p>
              <small>Triggered {formatDate(alert.createdAt)} from {alert.sourceReportIds.length} report{alert.sourceReportIds.length === 1 ? "" : "s"}</small>
              <div className="wellness-alert-card__reports">{alert.sourceReportIds.map((report) => <span key={report._id}>{formatDate(report.visitDate)}</span>)}</div>
              {alert.resolutionNote && <div className="record-note">Resolution: {alert.resolutionNote}</div>}
              {alert.status !== "resolved" && (
                <div className="wellness-alert-actions">
                  {alert.status === "active" && <Button variant="secondary" isLoading={busyAlertId === alert._id} disabled={Boolean(busyAlertId)} onClick={() => acknowledge(alert)}><CheckIcon size={16} /> Acknowledge</Button>}
                  <Button disabled={Boolean(busyAlertId)} onClick={() => openResolve(alert)}>Resolve</Button>
                </div>
              )}
            </Card>
          ))}
        </div>
        {alertPagination && <Pagination page={alertPagination.page} pages={alertPagination.pages} total={alertPagination.total} label="alerts" disabled={loadingAlerts} onPageChange={setAlertPage} />}
      </section>

      <Card className="wellness-insight-card">
        <div className="wellness-insight-card__heading">
          <div><span className="feature-icon"><InsightsIcon /></span><div><h2>Family wellness summary</h2><p>Generated only when requested.</p></div></div>
          <Button isLoading={generatingInsight} disabled={loadingInsight} onClick={generate}>{insight ? "Refresh summary" : "Generate summary"}</Button>
        </div>
        {loadingInsight && <div className="page-loader-inline"><span className="spinner" /> Loading saved summary</div>}
        {insightError && <div className="alert alert--error">{insightError}</div>}
        {!loadingInsight && !insight && <p>No saved summary yet.</p>}
        {insight && (
          <div className="wellness-insight-content">
            <div className="wellness-insight-meta"><span>{formatDate(insight.periodStart)} to {formatDate(insight.periodEnd)}</span><span>Generated by {insight.generatedBy}</span><span>{formatDate(insight.generatedAt)}</span></div>
            <p>{insight.summary}</p>
            <h3>Highlights</h3>
            <ul>{insight.highlights.map((highlight) => <li key={highlight}>{highlight}</li>)}</ul>
            <h3>Recommended follow-up</h3>
            <p>{insight.recommendedFollowUp}</p>
          </div>
        )}
        <div className="wellness-disclaimer">This limited summary is not medical advice or a diagnosis. Contact a qualified healthcare professional for health concerns.</div>
      </Card>

      <Modal isOpen={Boolean(resolvingAlert)} title="Resolve wellness alert" onClose={closeResolve}>
        <label className="field" htmlFor="resolution-note"><span>Resolution note</span><textarea id="resolution-note" className="input textarea" maxLength={1000} value={resolutionNote} onChange={(event) => setResolutionNote(event.target.value)} /></label>
        <div className="modal-actions"><Button variant="secondary" disabled={Boolean(busyAlertId)} onClick={closeResolve}>Cancel</Button><Button isLoading={Boolean(busyAlertId)} disabled={resolutionNote.trim().length < 3} onClick={resolve}>Resolve alert</Button></div>
      </Modal>
    </div>
  );
}
