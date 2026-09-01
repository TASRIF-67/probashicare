import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader.jsx";
import { Card } from "../../components/Card.jsx";
import { CaregiverHeader } from "../../components/caregiver/CaregiverHeader.jsx";
import { ActivityIcon, ArrowLeftIcon, HeartPulseIcon, PillIcon, UtensilsIcon } from "../../components/Icons.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import { normalizeApiError } from "../../services/api.js";
import { wellnessReportService } from "../../services/wellnessReportService.js";

/**
 * Converts a stored enum-style value into a readable label.
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
 * Formats an optional date and time for report detail display.
 * @param {string|Date|null} value - Stored date value.
 * @returns {string} Localized date/time or `Not recorded`.
 * @sideEffects None.
 */
function formatDateTime(value) {
  if (!value) {
    return "Not recorded";
  }

  const formatter = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return formatter.format(new Date(value));
}

/**
 * Renders one report detail label and value.
 * @param {{label: string, value: import("react").ReactNode}} props - Detail content.
 * @returns {import("react").ReactElement} Definition-list item.
 * @sideEffects None.
 */
function ReportDetail({ label, value }) {
  let displayedValue = value;

  if (displayedValue === null || displayedValue === undefined) {
    displayedValue = "Not recorded";
  }

  return (
    <div>
      <dt>{label}</dt>
      <dd>{displayedValue}</dd>
    </div>
  );
}

/**
 * Displays one authorized wellness report for a caregiver or linked family member.
 * @param {void} _unused - Route params and auth context supply page identity.
 * @returns {import("react").ReactElement} Read-only structured wellness report.
 * @sideEffects Loads one report from the API.
 */
export function WellnessReportDetailPage() {
  const { reportId, profileId } = useParams();
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, report: null, error: "" });
  const isCaregiver = user.role === "caregiver";
  const Header = isCaregiver ? CaregiverHeader : AppHeader;
  const backPath = isCaregiver
    ? "/caregiver/wellness-reports"
    : "/wellness/" + profileId;

  useEffect(() => {
    /**
     * Loads the report allowed for the signed-in user.
     * @returns {Promise<void>}
     * @sideEffects Reads the report API and updates page state.
     */
    async function loadReport() {
      try {
        const data = await wellnessReportService.getReport(reportId);

        setState({
          loading: false,
          report: data.report,
          error: "",
        });
      } catch (error) {
        const normalizedError = normalizeApiError(error);

        setState({
          loading: false,
          report: null,
          error: normalizedError.message,
        });
      }
    }

    loadReport();
  }, [reportId]);

if (state.loading) {
    return (
      <main>
        <Header />
        <div className="page-loader">
          <span className="spinner" />
          Loading wellness report
        </div>
      </main>
    );
  }

  if (state.error) {
    return (
      <main>
        <Header />
        <div className="center-page">
          <h1>Report unavailable</h1>
          <p>{state.error}</p>
          <Link
            className="button button--secondary"
            to={backPath}
          >
            <ArrowLeftIcon size={18} />
            Return to reports
          </Link>
        </div>
      </main>
    );
  }

  const report = state.report;
  let pageClassName = "feature-page wellness-detail-page";

  if (isCaregiver) {
    pageClassName = "caregiver-page wellness-detail-page";
  }

  let statusBadgeClassName = "status-badge";

  if (report.status === "submitted") {
    statusBadgeClassName += " status-badge--success";
  }

  const elderlyName =
    report.elderly?.preferredName || report.elderly?.fullName;
  const caregiverName = report.caregiver?.name || "Caregiver";
  let exerciseDuration = "Not recorded";
  let bloodPressure = "Not recorded";
  let bloodSugar = "Not recorded";
  let weight = "Not recorded";

  if (report.exerciseDurationMinutes !== null
      && report.exerciseDurationMinutes !== undefined) {
    exerciseDuration = report.exerciseDurationMinutes + " minutes";
  }

  if (report.vitals?.systolic !== null
      && report.vitals?.systolic !== undefined) {
    bloodPressure =
      report.vitals.systolic
      + "/"
      + report.vitals.diastolic
      + " mmHg";
  }

  if (report.vitals?.bloodSugar !== null
      && report.vitals?.bloodSugar !== undefined) {
    bloodSugar =
      report.vitals.bloodSugar
      + " mg/dL ("
      + humanize(report.vitals.bloodSugarContext)
      + ")";
  }

  if (report.vitals?.weightKg !== null
      && report.vitals?.weightKg !== undefined) {
    weight = report.vitals.weightKg + " kg";
  }

  return (
    <main>
      <Header />
      <div className={pageClassName}>
        <Link
          className="profile-back-link"
          to={backPath}
        >
          <ArrowLeftIcon size={17} />
          Wellness reports
        </Link>

        <section className="wellness-detail-hero">
          <div>
            <span className="eyebrow">
              {report.status} care record
            </span>
            <h1>{elderlyName}</h1>
            <p>
              Visit on {formatDateTime(report.visitDate)}
              {" · "}
              Reported by {caregiverName}
            </p>
          </div>
          <span className={statusBadgeClassName}>
            {report.status}
          </span>
        </section>

        <div className="wellness-detail-grid">
          <Card className="wellness-detail-card">
            <div className="wellness-detail-card__heading">
              <span>
                <ActivityIcon />
              </span>
              <h2>Visit and wellness</h2>
            </div>
            <dl>
              <ReportDetail
                label="Check in"
                value={formatDateTime(report.checkInAt)}
              />
              <ReportDetail
                label="Check out"
                value={formatDateTime(report.checkOutAt)}
              />
              <ReportDetail
                label="Mood"
                value={humanize(report.mood)}
              />
              <ReportDetail
                label="Exercise"
                value={exerciseDuration}
              />
              <ReportDetail
                label="Next visit"
                value={formatDateTime(report.nextVisitDate)}
              />
            </dl>
          </Card>

          <Card className="wellness-detail-card">
            <div className="wellness-detail-card__heading">
              <span>
                <UtensilsIcon />
              </span>
              <h2>Meals</h2>
            </div>
            <dl>
              <ReportDetail
                label="Meal status"
                value={humanize(report.mealStatus)}
              />
            </dl>
            <p>{report.mealNotes || "No meal notes were added."}</p>
          </Card>

          <Card className="wellness-detail-card">
            <div className="wellness-detail-card__heading">
              <span>
                <PillIcon />
              </span>
              <h2>Medicine summary</h2>
            </div>
            <dl>
              <ReportDetail
                label="Intake status"
                value={humanize(report.medicineIntakeStatus)}
              />
            </dl>
            <p>
              {report.medicineNotes || "No medicine notes were added."}
            </p>
          </Card>

          <Card className="wellness-detail-card wellness-detail-card--wide">
            <div className="wellness-detail-card__heading">
              <span>
                <HeartPulseIcon />
              </span>
              <h2>Vitals</h2>
            </div>
            <dl className="wellness-vitals-detail">
              <ReportDetail
                label="Blood pressure"
                value={bloodPressure}
              />
              <ReportDetail
                label="Blood sugar"
                value={bloodSugar}
              />
              <ReportDetail
                label="Weight"
                value={weight}
              />
              <ReportDetail
                label="Measured at"
                value={formatDateTime(report.vitals?.measuredAt)}
              />
            </dl>
          </Card>

          <Card className="wellness-detail-card wellness-detail-card--wide">
            <div className="wellness-detail-card__heading">
              <span>
                <ActivityIcon />
              </span>
              <h2>Health observations</h2>
            </div>
            <p>
              {report.observations || "No health observations were added."}
            </p>
            {report.caregiverNotes && (
              <div className="wellness-handoff">
                <strong>Caregiver handoff</strong>
                <p>{report.caregiverNotes}</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </main>
  );
}