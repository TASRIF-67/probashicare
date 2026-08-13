import { BadgeCheckIcon, BellIcon, HeartPulseIcon, ShieldCheckIcon, UsersIcon } from "../Icons.jsx";

/** Shows the decorative connected-care visual. @param {{compact?: boolean}} props Visual options. @returns {import("react").ReactElement} Network visual. @sideEffects None. */
export function CareNetworkVisual({ compact = false }) {
  const className = compact
    ? "care-network-visual care-network-visual--compact"
    : "care-network-visual";

  return (
    <div className={className} aria-hidden="true">
      <div className="care-network-visual__glow" />
      <svg className="care-network-visual__lines" viewBox="0 0 600 520">
        <path d="M300 258 L135 140" />
        <path d="M300 258 L470 140" />
        <path d="M300 258 L300 430" />
      </svg>
      <div className="care-node care-node--elderly"><span><HeartPulseIcon /></span><strong>Elderly care</strong><small>At the centre</small></div>
      <div className="care-node care-node--family"><span><UsersIcon /></span><strong>Family</strong><small>Always informed</small></div>
      <div className="care-node care-node--caregiver"><span><BadgeCheckIcon /></span><strong>Caregiver</strong><small>Verified locally</small></div>
      <div className="care-node care-node--safety"><span><ShieldCheckIcon /></span><strong>Health context</strong><small>Shared securely</small></div>
      <div className="network-update network-update--report"><span><HeartPulseIcon /></span><div><small>Daily update</small><strong>Wellness report received</strong></div></div>
      <div className="network-update network-update--alert"><span><BellIcon /></span><div><small>Care status</small><strong>Family notified</strong></div></div>
    </div>
  );
}
