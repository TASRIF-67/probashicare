import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../components/Card.jsx";
import {
  ArchiveIcon,
  ArrowRightIcon,
  BriefcaseIcon,
  ClockIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "../../components/Icons.jsx";
import { adminService } from "../../services/adminService.js";
import { normalizeApiError } from "../../services/api.js";

/**
 * Formats a recent registration timestamp.
 * @param {string|Date} value - API timestamp.
 * @returns {string} Localized short date.
 * @sideEffects None.
 */
function formatDate(value) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
}

/**
 * Renders the live operational summary for the current implemented admin scope.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Metrics, attention queue, and recent registrations.
 * @sideEffects Loads overview aggregates from the protected admin API.
 */
export function AdminOverviewPage() {
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    adminService.getOverview().then(setOverview).catch((requestError) => setError(normalizeApiError(requestError).message));
  }, []);

  if (error) return <div className="alert alert--error">{error}</div>;
  if (!overview) return <div className="page-loader-inline"><span className="spinner" /> Loading overview</div>;

  const { metrics, attention, recentRegistrations } = overview;
  return (
    <>
      <div className="admin-heading"><div><span className="eyebrow">Overview</span><h1>Platform operations</h1><p>A live summary of family access, elderly profiles, and caregiver verification.</p></div><span className="live-status"><span /> Live data</span></div>
      <section className="overview-metrics" aria-label="Platform metrics">
        <Card className="overview-metric"><span className="metric-card__icon"><UsersIcon /></span><div><small>Family accounts</small><strong>{metrics.totalFamilies}</strong><span>{metrics.verifiedFamilies} verified</span></div></Card>
        <Card className="overview-metric"><span className="metric-card__icon metric-card__icon--success"><ShieldCheckIcon /></span><div><small>Active elderly profiles</small><strong>{metrics.activeElderlyProfiles}</strong><span>Available to linked families</span></div></Card>
        <Card className="overview-metric"><span className="metric-card__icon metric-card__icon--pending"><ClockIcon /></span><div><small>Awaiting verification</small><strong>{metrics.unverifiedFamilies}</strong><span>Family email not confirmed</span></div></Card>
        <Card className="overview-metric"><span className="metric-card__icon overview-metric__archive"><ArchiveIcon /></span><div><small>Archived profiles</small><strong>{metrics.archivedElderlyProfiles}</strong><span>Preserved health records</span></div></Card>
        <Card className="overview-metric"><span className="metric-card__icon metric-card__icon--pending"><BriefcaseIcon /></span><div><small>Caregiver reviews</small><strong>{metrics.submittedCaregiverApplications}</strong><span>{metrics.approvedCaregivers} approved caregivers</span></div></Card>
      </section>
      <div className="overview-grid">
        <Card className="overview-panel">
          <div className="overview-panel__header"><div><h2>Needs attention</h2><p>Current administrative work from active modules.</p></div></div>
          {attention.submittedCaregiverApplications > 0 && <Link className="attention-row" to="/admin/caregivers"><span className="attention-row__icon"><BriefcaseIcon size={19} /></span><span><strong>Caregiver applications</strong><small>{attention.submittedCaregiverApplications} application{attention.submittedCaregiverApplications === 1 ? "" : "s"} ready for review</small></span><ArrowRightIcon size={18} /></Link>}
          {attention.unverifiedFamilyAccounts > 0 && <Link className="attention-row" to="/admin/accounts"><span className="attention-row__icon"><ClockIcon size={19} /></span><span><strong>Unverified family accounts</strong><small>{attention.unverifiedFamilyAccounts} registration{attention.unverifiedFamilyAccounts === 1 ? "" : "s"} waiting for email confirmation</small></span><ArrowRightIcon size={18} /></Link>}
          {!attention.unverifiedFamilyAccounts && !attention.submittedCaregiverApplications && (
            <div className="overview-empty"><ShieldCheckIcon /><strong>Nothing needs attention</strong><span>All registered family emails are verified.</span></div>
          )}
        </Card>
        <Card className="overview-panel">
          <div className="overview-panel__header"><div><h2>Recent registrations</h2><p>Latest family accounts created.</p></div><Link to="/admin/accounts">View all <ArrowRightIcon size={15} /></Link></div>
          <div className="recent-list">
            {!recentRegistrations.length && <div className="overview-empty"><UsersIcon /><strong>No registrations yet</strong></div>}
            {recentRegistrations.map((registration) => <div className="recent-row" key={registration.id}><span className="profile-avatar">{registration.name[0]}</span><span><strong>{registration.name}</strong><small>{registration.email}</small></span><span className={registration.isVerified ? "status-badge status-badge--success" : "status-badge"}>{registration.isVerified ? "Verified" : "Pending"}</span><time>{formatDate(registration.createdAt)}</time></div>)}
          </div>
        </Card>
      </div>
    </>
  );
}
