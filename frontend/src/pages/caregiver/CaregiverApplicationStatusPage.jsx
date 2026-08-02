import { CaregiverHeader } from "../../components/caregiver/CaregiverHeader.jsx";
import { Card } from "../../components/Card.jsx";
import { ClockIcon, ShieldCheckIcon } from "../../components/Icons.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

/**
 * Shows a locked holding page for submitted or suspended caregiver accounts.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Status-specific caregiver holding page.
 * @sideEffects None.
 */
export function CaregiverApplicationStatusPage() {
  const { user } = useAuth();
  const isSuspended = user.caregiverApplicationStatus === "suspended";
  return <main><CaregiverHeader /><div className="status-page"><Card className="application-status-card"><span className={isSuspended ? "status-orb status-orb--danger" : "status-orb"}>{isSuspended ? <ShieldCheckIcon /> : <ClockIcon />}</span><span className="eyebrow">Application status</span><h1>{isSuspended ? "Account suspended" : "Application under review"}</h1><p>{isSuspended ? "Your caregiver access is currently suspended. Contact platform support for the next steps." : "Your application has been submitted and is locked while an administrator reviews it. You will receive access after approval."}</p><div className="review-steps"><span className="review-step review-step--done">Application submitted</span><span className="review-step review-step--active">Admin review</span><span className="review-step">Dashboard access</span></div></Card></div></main>;
}
