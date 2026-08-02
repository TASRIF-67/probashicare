import { Link } from "react-router-dom";
import { Card } from "../../components/Card.jsx";
import { CaregiverHeader } from "../../components/caregiver/CaregiverHeader.jsx";
import { BadgeCheckIcon, BriefcaseIcon, PencilIcon } from "../../components/Icons.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

/**
 * Renders the initial operational landing page for approved caregivers.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Approved caregiver dashboard shell.
 * @sideEffects Navigates to profile management when selected.
 */
export function CaregiverDashboardPage() {
  const { user } = useAuth();
  return <main><CaregiverHeader /><div className="caregiver-page"><div className="approved-hero"><span className="status-orb status-orb--approved"><BadgeCheckIcon /></span><div><span className="eyebrow">Verified caregiver</span><h1>Welcome, {user.name}.</h1><p>Your caregiver account is approved and ready for future booking workflows.</p></div></div><div className="caregiver-dashboard-grid"><Card><span className="feature-icon"><BriefcaseIcon /></span><h2>Your professional profile</h2><p>Keep your bio, skills, rates, service area, and availability current.</p><Link className="button button--primary" to="/caregiver/profile"><PencilIcon size={17} /> Manage profile</Link></Card><Card><h2>Bookings coming next</h2><p>Assigned visits, check-in tasks, reports, and care schedules will appear here when the Care Coordination module is built.</p></Card></div></div></main>;
}
