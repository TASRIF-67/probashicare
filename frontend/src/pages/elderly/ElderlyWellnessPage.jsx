import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader.jsx";
import { Card } from "../../components/Card.jsx";
import { Pagination } from "../../components/Pagination.jsx";
import { ActivityIcon, ArrowLeftIcon, ArrowRightIcon, CalendarIcon, ClockIcon, HeartPulseIcon, PillIcon } from "../../components/Icons.jsx";
import { VitalsTrendChart } from "../../components/wellness/VitalsTrendChart.jsx";
import { WellnessInsightsPanel } from "../../components/wellness/WellnessInsightsPanel.jsx";
import { normalizeApiError } from "../../services/api.js";
import { elderlyProfileService } from "../../services/elderlyProfileService.js";
import { wellnessReportService } from "../../services/wellnessReportService.js";

/**
 * Formats a stored date for family report history.
 * @param {string|Date|null} value - Stored date value.
 * @returns {string} Localized medium date or `Not recorded`.
 * @sideEffects None.
 */
function formatDate(value) {
  if (!value) {
    return "Not recorded";
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  });
  return formatter.format(new Date(value));
}

/**
 * Converts an enum-style value into a readable family-facing label.
 * @param {unknown} value - Stored string value.
 * @returns {string} Capitalized text or `Not recorded`.
 * @sideEffects None.
 */
function humanize(value) {
  if (!value) {
    return "Not recorded";
  }

  const text = String(value).replaceAll("-", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Presents the newest wellness report with caregiver attribution and care highlights.
 * @param {{report: object, profileId: string}} props - Latest submitted report and elderly profile ID.
 * @returns {import("react").ReactElement} Enhanced latest-report hero.
 * @sideEffects None.
 */
function LatestWellnessSummary({ report, profileId }) {
  const caregiverName = report.caregiver?.name || "Assigned caregiver";
  const caregiverInitial = caregiverName.charAt(0).toUpperCase();
  let bloodPressure = "Blood pressure not recorded";

  if (
    report.vitals?.systolic != null &&
    report.vitals?.diastolic != null
  ) {
    bloodPressure =
      report.vitals.systolic +
      "/" +
      report.vitals.diastolic +
      " mmHg";
  }

  return (
    <section className="latest-wellness latest-wellness--enhanced">
      <div className="latest-wellness__main">
        <div className="latest-wellness__topline">
          <span className="wellness-kicker">
            Latest submitted report
          </span>
          <span className="status-badge status-badge--success">
            {humanize(report.status)}
          </span>
        </div>

        <h2>
          {humanize(report.mood)} mood, {humanize(report.mealStatus).toLowerCase()} meal
        </h2>
        <p className="latest-wellness__observation">
          {report.observations || "No additional observation was recorded."}
        </p>

        <div className="latest-wellness__caregiver">
          <span className="profile-avatar">{caregiverInitial}</span>
          <div>
            <small>Submitted by</small>
            <strong>{caregiverName}</strong>
          </div>
        </div>

        <div className="latest-wellness__facts">
          <span>
            <CalendarIcon size={16} />
            Visit: {formatDate(report.visitDate)}
          </span>
          <span>
            <ClockIcon size={16} />
            Submitted: {formatDate(report.submittedAt || report.createdAt)}
          </span>
          <span>
            <PillIcon size={16} />
            Medicine: {humanize(report.medicineIntakeStatus)}
          </span>
          <span>
            <HeartPulseIcon size={16} />
            {bloodPressure}
          </span>
        </div>
      </div>

      <Link
        className="button button--primary latest-wellness__action"
        to={`/elderly-profiles/${profileId}/wellness-reports/${report._id}`}
      >
        View full report
        <ArrowRightIcon size={17} />
      </Link>
    </section>
  );
}
/**
 * Displays submitted caregiver reports and thirty-day vitals trends for one elderly profile.
 * @param {void} _unused - The route supplies the elderly profile identifier.
 * @returns {import("react").ReactElement} Family wellness-monitoring page.
 * @sideEffects Loads profile identity, submitted reports, and vitals trend data in parallel.
 */
export function ElderlyWellnessPage() {
  const { profileId } = useParams();
  const [page, setPage] = useState(1);
  const [state, setState] = useState({ loading: true, profile: null, reports: [], latestReport: null, pagination: null, points: [], error: "" });

  useEffect(() => {
    /**
     * Loads the profile, reports, and trend points for this page.
     * @returns {Promise<void>}
     * @sideEffects Reads three APIs and updates page state.
     */
    async function loadWellnessHistory() {
      try {
        // Promise.all runs independent requests together, then waits for every result.
        const results = await Promise.all([
          elderlyProfileService.getProfile(profileId),
          wellnessReportService.listElderlyReports(profileId, { page, limit: 3 }),
          wellnessReportService.getVitalsTrends(profileId),
        ]);
        const profileData = results[0];
        const reportData = results[1];
        const trendData = results[2];

        setState({
          loading: false,
          profile: profileData.profile,
          reports: reportData.reports,
          latestReport: page === 1 ? reportData.reports[0] || null : state.latestReport,
          pagination: reportData.pagination,
          points: trendData.points,
          error: "",
        });
      } catch (error) {
        const normalizedError = normalizeApiError(error);

        setState({
          loading: false,
          profile: null,
          reports: [],
          latestReport: null,
          pagination: null,
          points: [],
          error: normalizedError.message,
        });
      }
    }

    loadWellnessHistory();
  }, [page, profileId]);

  if (state.loading) return <main><AppHeader /><div className="page-loader"><span className="spinner" /> Loading wellness history</div></main>;
  if (state.error) return <main><AppHeader /><div className="center-page"><h1>Wellness history unavailable</h1><p>{state.error}</p><Link className="button button--secondary" to={`/elderly-profiles/${profileId}`}><ArrowLeftIcon size={18} /> Return to profile</Link></div></main>;

  const latest = state.latestReport;
  const personal = state.profile.personalInformation;
  return (
    <main>
      <AppHeader />
      <div className="feature-page elderly-wellness-page">
        <Link className="profile-back-link" to={`/elderly-profiles/${profileId}`}><ArrowLeftIcon size={17} /> {personal.preferredName || personal.fullName}'s profile</Link>
        <div className="page-heading wellness-page-heading">
          <div>
            <span className="eyebrow">Remote care monitoring</span>
            <h1>Wellness and vitals</h1>
            <p>
              Review caregiver observations and measurement history for {personal.preferredName || personal.fullName}.
            </p>
          </div>
          <div className="wellness-page-heading__meta">
            <span>{personal.preferredName || personal.fullName}</span>
            <span>{state.pagination?.total || 0} submitted reports</span>
            <span>30-day vital trends</span>
          </div>
        </div>

        {latest ? (
          <LatestWellnessSummary report={latest} profileId={profileId} />
        ) : (
          <Card className="wellness-empty">
            <span className="feature-icon"><ActivityIcon /></span>
            <h2>No submitted wellness reports</h2>
            <p>Caregiver reports will appear here after an assigned caregiver submits a visit update.</p>
          </Card>
        )}
        <WellnessInsightsPanel profileId={profileId} />

        <section className="wellness-section-heading"><div><span><HeartPulseIcon /></span><div><h2>30-day vitals trends</h2><p>Measurements are shown as recorded and are not an automated medical assessment.</p></div></div></section>
        <div className="vitals-trend-grid"><VitalsTrendChart points={state.points} metric="systolic" label="Systolic blood pressure" unit="mmHg" /><VitalsTrendChart points={state.points} metric="bloodSugar" label="Blood sugar" unit="mg/dL" /><VitalsTrendChart points={state.points} metric="weightKg" label="Weight" unit="kg" /></div>

        <section className="wellness-section-heading wellness-section-heading--history"><div><span><ActivityIcon /></span><div><h2>Submitted report history</h2><p>{state.pagination?.total || 0} submitted report{state.pagination?.total === 1 ? "" : "s"}</p></div></div></section>
        <div className="family-wellness-list">{state.reports.map((report) => <Link className="family-wellness-row" to={`/elderly-profiles/${profileId}/wellness-reports/${report._id}`} key={report._id}><div><span>{formatDate(report.visitDate)}</span><h3>{humanize(report.mood)} mood</h3><p>{report.observations}</p></div><div className="family-wellness-row__meta"><span>{report.vitals?.systolic == null ? "No BP" : `${report.vitals.systolic}/${report.vitals.diastolic} mmHg`}</span><span>{report.caregiver?.name || "Caregiver"}</span></div><ArrowRightIcon size={18} /></Link>)}</div>
        {state.pagination && <Pagination page={state.pagination.page} pages={state.pagination.pages} total={state.pagination.total} label="reports" disabled={state.loading} onPageChange={setPage} />}
      </div>
    </main>
  );
}
