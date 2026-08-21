import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader.jsx";
import { Card } from "../../components/Card.jsx";
import { Pagination } from "../../components/Pagination.jsx";
import {
  ActivityIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  ClockIcon,
  HeartPulseIcon,
  InsightsIcon,
  PillIcon,
  ShieldCheckIcon,
} from "../../components/Icons.jsx";
import { VitalsTrendChart } from "../../components/wellness/VitalsTrendChart.jsx";
import { WellnessInsightsPanel } from "../../components/wellness/WellnessInsightsPanel.jsx";
import { useSubscription } from "../../context/SubscriptionContext.jsx";
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
        to={`/wellness/${profileId}/reports/${report._id}`}
      >
        View full report
        <ArrowRightIcon size={17} />
      </Link>
    </section>
  );
}

/**
 * Explains which wellness tools require Premium and links to the plan page.
 * @param {{profileName: string}} props - Readable elderly profile name.
 * @returns {import("react").ReactElement} Premium wellness upgrade notice.
 * @sideEffects React Router navigates when the plans link is selected.
 */
function PremiumWellnessNotice({ profileName }) {
  return (
    <Card className="wellness-premium-notice">
      <div className="wellness-premium-notice__visual" aria-hidden="true">
        <svg viewBox="0 0 150 92" focusable="false">
          <path d="M 5 70 C 28 69, 31 51, 48 55 C 63 59, 68 27, 82 29 C 94 31, 101 66, 118 40 C 129 23, 135 22, 145 20" />
          <circle cx="118" cy="40" r="5" />
        </svg>
        <span>
          <HeartPulseIcon size={17} />
        </span>
      </div>
      <div className="wellness-premium-notice__copy">
        <span className="wellness-premium-label">
          <InsightsIcon size={13} />
          Premium tools
        </span>
        <h2>Unlock early alerts, summaries, and 30-day trends</h2>
        <p>
          Submitted caregiver reports for {profileName} remain available. Start
          a trial or choose a Premium plan to use pattern alerts, Gemini or
          fallback summaries, and advanced vital charts.
        </p>
      </div>
      <div className="wellness-premium-notice__action">
        <Link className="button button--primary" to="/subscription">
          View Premium plans
          <ArrowRightIcon size={17} />
        </Link>
        <small>
          <ShieldCheckIcon size={13} />
          Secure care access
        </small>
      </div>
    </Card>
  );
}

/**
 * Confirms that paid or trial Premium wellness tools are currently available.
 * @param {{accessLabel: string}} props - Readable active plan description.
 * @returns {import("react").ReactElement} Active Premium access banner.
 * @sideEffects React Router navigates when Manage plan is selected.
 */
function PremiumWellnessActive({ accessLabel }) {
  return (
    <Card className="wellness-premium-active">
      <span className="wellness-premium-active__icon" aria-hidden="true">
        <InsightsIcon size={20} />
      </span>
      <div>
        <span className="eyebrow">Premium wellness active</span>
        <h2>Insights, early alerts, and 30-day trends are unlocked.</h2>
        <p>{accessLabel} gives this family access to every wellness insight below.</p>
      </div>
      <Link to="/subscription">
        Manage plan
        <ArrowRightIcon size={15} />
      </Link>
    </Card>
  );
}

/**
 * Converts shared subscription data into a wellness-specific access label.
 * @param {object|null} subscriptionData - Backend subscription response.
 * @returns {{label: string, tone: "free"|"trial"|"premium"}} Label and visual tone.
 * @sideEffects None.
 */
function getWellnessAccessPresentation(subscriptionData) {
  const access = subscriptionData?.access;
  const subscription = subscriptionData?.subscription;

  if (access?.isPremium && subscription?.status === "trialing") {
    return {
      label: "Premium trial active",
      tone: "trial",
    };
  }

  if (access?.isPremium) {
    const planName = subscription?.planSnapshot?.name || "Premium";
    return {
      label: planName + " Premium active",
      tone: "premium",
    };
  }

  return {
    label: "Premium insights available",
    tone: "free",
  };
}

/**
 * Displays the identity, report count, subscription access, and subtle health
 * signal that introduce one elderly person's wellness workspace.
 * @param {{profileName: string, reportCount: number, accessPresentation: {label: string, tone: string}}} props - Wellness heading data.
 * @returns {import("react").ReactElement} Dedicated wellness page hero.
 * @sideEffects None.
 */
function WellnessPageHero({
  profileName,
  reportCount,
  accessPresentation,
}) {
  let reportLabel = reportCount + " submitted reports";

  if (reportCount === 1) {
    reportLabel = "1 submitted report";
  }

  return (
    <header className="wellness-monitor-hero">
      <svg
        className="wellness-monitor-hero__signal"
        viewBox="0 0 560 140"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M 0 83 C 55 83, 65 70, 93 83 C 122 96, 135 32, 157 78 C 177 118, 194 89, 218 84 C 254 76, 258 28, 276 35 C 293 41, 289 132, 315 131 C 339 130, 340 74, 367 81 C 407 91, 437 78, 472 82 C 509 87, 528 83, 560 83" />
      </svg>

      <div className="wellness-monitor-hero__copy">
        <h1>Wellness and vitals</h1>
        <p>
          Review caregiver observations and measurement history for {profileName}.
        </p>
      </div>

      <div className="wellness-monitor-hero__meta">
        <span>
          <span className="wellness-monitor-hero__meta-icon" aria-hidden="true">
            {profileName.charAt(0).toUpperCase()}
          </span>
          {profileName}
        </span>
        <span>
          <ActivityIcon size={14} />
          {reportLabel}
        </span>
        <span className={`wellness-access-pill wellness-access-pill--${accessPresentation.tone}`}>
          <InsightsIcon size={14} />
          {accessPresentation.label}
        </span>
      </div>
    </header>
  );
}

/**
 * Displays a calm empty state before the first caregiver wellness submission.
 * @returns {import("react").ReactElement} Empty wellness-report panel.
 * @sideEffects None.
 */
function WellnessEmptyState() {
  return (
    <section className="wellness-monitor-empty">
      <div className="wellness-monitor-empty__pulse" aria-hidden="true">
        <span>
          <ActivityIcon size={28} />
        </span>
        <i className="wellness-monitor-empty__spark wellness-monitor-empty__spark--one" />
        <i className="wellness-monitor-empty__spark wellness-monitor-empty__spark--two" />
        <i className="wellness-monitor-empty__spark wellness-monitor-empty__spark--three" />
      </div>
      <h2>No wellness reports yet</h2>
      <p>
        Caregiver reports will appear here after an assigned caregiver submits
        a visit update.
      </p>
    </section>
  );
}

/**
 * Displays submitted wellness reports using consistent desktop columns and
 * readable mobile report cards.
 * @param {{reports: object[], profileId: string, reportCount: number}} props - Current report page and profile identity.
 * @returns {import("react").ReactElement} Report-history table.
 * @sideEffects React Router navigates when a report row is selected.
 */
function WellnessReportHistory({
  reports,
  profileId,
  reportCount,
}) {
  let reportLabel = reportCount + " submitted reports";

  if (reportCount === 1) {
    reportLabel = "1 submitted report";
  }

  return (
    <section className="wellness-history-panel">
      <header className="wellness-history-panel__heading">
        <span aria-hidden="true">
          <ActivityIcon size={19} />
        </span>
        <div>
          <h2>Submitted report history</h2>
          <p>{reportLabel}</p>
        </div>
      </header>

      <div className="wellness-history-table" role="table" aria-label="Submitted wellness reports">
        <div className="wellness-history-table__header" role="row">
          <span role="columnheader">Date submitted</span>
          <span role="columnheader">Caregiver</span>
          <span role="columnheader">Report type</span>
          <span role="columnheader">Vitals summary</span>
          <span role="columnheader">Status</span>
          <span className="sr-only" role="columnheader">Open</span>
        </div>

        {reports.map(function renderReport(report) {
          let bloodPressure = "Not recorded";

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
            <Link
              className="wellness-history-table__row"
              to={`/wellness/${profileId}/reports/${report._id}`}
              key={report._id}
              role="row"
            >
              <span role="cell" data-label="Date submitted">
                {formatDate(report.submittedAt || report.createdAt)}
              </span>
              <span role="cell" data-label="Caregiver">
                {report.caregiver?.name || "Assigned caregiver"}
              </span>
              <span role="cell" data-label="Report type">
                Daily wellness
              </span>
              <span role="cell" data-label="Vitals summary">
                {bloodPressure}
              </span>
              <span role="cell" data-label="Status">
                <span className="status-badge status-badge--success">
                  {humanize(report.status)}
                </span>
              </span>
              <span className="wellness-history-table__open" role="cell">
                <ArrowRightIcon size={16} />
              </span>
            </Link>
          );
        })}

        {!reports.length && (
          <div className="wellness-history-table__empty">
            <ActivityIcon size={18} />
            <div>
              <strong>No submitted reports yet</strong>
              <span>
                Reports will be listed here after caregiver submission.
              </span>
            </div>
          </div>
        )}
      </div>
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
  const {
    data: subscriptionData,
    loading: subscriptionLoading,
  } = useSubscription();
  const [page, setPage] = useState(1);
  const [state, setState] = useState({
    loading: true,
    profile: null,
    reports: [],
    latestReport: null,
    pagination: null,
    points: [],
    hasPremium: false,
    error: "",
  });

  useEffect(() => {
    /**
     * Loads Core report history, subscription access, and allowed trend data.
     * @returns {Promise<void>}
     * @sideEffects Reads APIs and updates page state.
     */
    async function loadWellnessHistory() {
      if (subscriptionLoading) {
        return;
      }

      try {
        // Promise.all runs the two independent Core requests together.
        const results = await Promise.all([
          elderlyProfileService.getProfile(profileId),
          wellnessReportService.listElderlyReports(profileId, { page, limit: 3 }),
        ]);
        const profileData = results[0];
        const reportData = results[1];
        const hasPremium = Boolean(subscriptionData?.access?.isPremium);
        let points = [];

        if (hasPremium) {
          const trendData = await wellnessReportService.getVitalsTrends(profileId);
          points = trendData.points;
        }

        setState({
          loading: false,
          profile: profileData.profile,
          reports: reportData.reports,
          latestReport: page === 1 ? reportData.reports[0] || null : state.latestReport,
          pagination: reportData.pagination,
          points,
          hasPremium,
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
          hasPremium: false,
          error: normalizedError.message,
        });
      }
    }

    loadWellnessHistory();
  }, [page, profileId, subscriptionData, subscriptionLoading]);

  if (state.loading || subscriptionLoading) return <main><AppHeader /><div className="page-loader"><span className="spinner" /> Loading wellness history</div></main>;
  if (state.error) return <main><AppHeader /><div className="center-page"><h1>Wellness history unavailable</h1><p>{state.error}</p><Link className="button button--secondary" to="/wellness"><ArrowLeftIcon size={18} /> Return to wellness profiles</Link></div></main>;

  const latest = state.latestReport;
  const personal = state.profile.personalInformation;
  const accessPresentation = getWellnessAccessPresentation(subscriptionData);
  const profileName = personal.preferredName || personal.fullName;
  const reportCount = state.pagination?.total || 0;
  return (
    <main>
      <AppHeader />
      <div className="feature-page elderly-wellness-page">
        <Link className="wellness-monitor-back" to="/wellness">
          <ArrowLeftIcon size={16} />
          All wellness profiles
        </Link>
        <WellnessPageHero
          profileName={profileName}
          reportCount={reportCount}
          accessPresentation={accessPresentation}
        />

        {latest ? (
          <LatestWellnessSummary report={latest} profileId={profileId} />
        ) : (
          <WellnessEmptyState />
        )}
        {state.hasPremium ? (
          <>
            <PremiumWellnessActive accessLabel={accessPresentation.label} />
            <WellnessInsightsPanel profileId={profileId} />

            <section className="wellness-section-heading">
              <div>
                <span><HeartPulseIcon /></span>
                <div>
                  <h2>30-day vitals trends</h2>
                  <p>
                    Measurements are shown as recorded and are not an
                    automated medical assessment.
                  </p>
                </div>
              </div>
            </section>
            <div className="vitals-trend-grid">
              <VitalsTrendChart
                points={state.points}
                metric="systolic"
                label="Systolic blood pressure"
                unit="mmHg"
              />
              <VitalsTrendChart
                points={state.points}
                metric="bloodSugar"
                label="Blood sugar"
                unit="mg/dL"
              />
              <VitalsTrendChart
                points={state.points}
                metric="weightKg"
                label="Weight"
                unit="kg"
              />
            </div>
          </>
        ) : (
          <PremiumWellnessNotice
            profileName={profileName}
          />
        )}

        <WellnessReportHistory
          reports={state.reports}
          profileId={profileId}
          reportCount={reportCount}
        />
        {state.pagination && <Pagination page={state.pagination.page} pages={state.pagination.pages} total={state.pagination.total} label="reports" disabled={state.loading} onPageChange={setPage} />}
      </div>
    </main>
  );
}
