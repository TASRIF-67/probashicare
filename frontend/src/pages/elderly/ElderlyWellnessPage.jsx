import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader.jsx";
import { Card } from "../../components/Card.jsx";
import { ActivityIcon, ArrowLeftIcon, ArrowRightIcon, HeartPulseIcon } from "../../components/Icons.jsx";
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
 * Displays submitted caregiver reports and thirty-day vitals trends for one elderly profile.
 * @param {void} _unused - The route supplies the elderly profile identifier.
 * @returns {import("react").ReactElement} Family wellness-monitoring page.
 * @sideEffects Loads profile identity, submitted reports, and vitals trend data in parallel.
 */
export function ElderlyWellnessPage() {
  const { profileId } = useParams();
  const [state, setState] = useState({ loading: true, profile: null, reports: [], points: [], error: "" });

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
          wellnessReportService.listElderlyReports(profileId, { limit: 20 }),
          wellnessReportService.getVitalsTrends(profileId),
        ]);
        const profileData = results[0];
        const reportData = results[1];
        const trendData = results[2];

        setState({
          loading: false,
          profile: profileData.profile,
          reports: reportData.reports,
          points: trendData.points,
          error: "",
        });
      } catch (error) {
        const normalizedError = normalizeApiError(error);

        setState({
          loading: false,
          profile: null,
          reports: [],
          points: [],
          error: normalizedError.message,
        });
      }
    }

    loadWellnessHistory();
  }, [profileId]);

  if (state.loading) return <main><AppHeader /><div className="page-loader"><span className="spinner" /> Loading wellness history</div></main>;
  if (state.error) return <main><AppHeader /><div className="center-page"><h1>Wellness history unavailable</h1><p>{state.error}</p><Link className="button button--secondary" to={`/elderly-profiles/${profileId}`}><ArrowLeftIcon size={18} /> Return to profile</Link></div></main>;

  const latest = state.reports[0];
  const personal = state.profile.personalInformation;
  return (
    <main>
      <AppHeader />
      <div className="feature-page elderly-wellness-page">
        <Link className="profile-back-link" to={`/elderly-profiles/${profileId}`}><ArrowLeftIcon size={17} /> {personal.preferredName || personal.fullName}'s profile</Link>
        <div className="page-heading"><span className="eyebrow">Remote care monitoring</span><h1>Wellness and vitals</h1><p>Review submitted caregiver observations and measurement history for {personal.preferredName || personal.fullName}.</p></div>

        {latest ? <section className="latest-wellness"><div><span className="wellness-kicker">Latest report · {formatDate(latest.visitDate)}</span><h2>{humanize(latest.mood)} mood, {humanize(latest.mealStatus).toLowerCase()} meal</h2><p>{latest.observations}</p><span>Reported by {latest.caregiver?.name || "Caregiver"}</span></div><Link className="button button--primary" to={`/elderly-profiles/${profileId}/wellness-reports/${latest._id}`}>Open report <ArrowRightIcon size={17} /></Link></section> : <Card className="wellness-empty"><span className="feature-icon"><ActivityIcon /></span><h2>No submitted wellness reports</h2><p>Caregiver reports will appear here after an assigned caregiver submits a visit update.</p></Card>}

        <WellnessInsightsPanel profileId={profileId} />

        <section className="wellness-section-heading"><div><span><HeartPulseIcon /></span><div><h2>30-day vitals trends</h2><p>Measurements are shown as recorded and are not an automated medical assessment.</p></div></div></section>
        <div className="vitals-trend-grid"><VitalsTrendChart points={state.points} metric="systolic" label="Systolic blood pressure" unit="mmHg" /><VitalsTrendChart points={state.points} metric="bloodSugar" label="Blood sugar" unit="mg/dL" /><VitalsTrendChart points={state.points} metric="weightKg" label="Weight" unit="kg" /></div>

        <section className="wellness-section-heading wellness-section-heading--history"><div><span><ActivityIcon /></span><div><h2>Submitted report history</h2><p>{state.reports.length} recent report{state.reports.length === 1 ? "" : "s"}</p></div></div></section>
        <div className="family-wellness-list">{state.reports.map((report) => <Link className="family-wellness-row" to={`/elderly-profiles/${profileId}/wellness-reports/${report._id}`} key={report._id}><div><span>{formatDate(report.visitDate)}</span><h3>{humanize(report.mood)} mood</h3><p>{report.observations}</p></div><div className="family-wellness-row__meta"><span>{report.vitals?.systolic == null ? "No BP" : `${report.vitals.systolic}/${report.vitals.diastolic} mmHg`}</span><span>{report.caregiver?.name || "Caregiver"}</span></div><ArrowRightIcon size={18} /></Link>)}</div>
      </div>
    </main>
  );
}
