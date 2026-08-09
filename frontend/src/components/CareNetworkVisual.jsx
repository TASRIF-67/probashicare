import {
  ActivityIcon,
  BellIcon,
  CareIcon,
  CheckIcon,
  HeartPulseIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "./Icons.jsx";

/**
 * Renders an animated relationship map between a family, caregiver, and elderly relative.
 * @param {{compact?: boolean, className?: string}} props - Compact sizing preference and optional wrapper class.
 * @returns {import("react").ReactElement} Decorative care-network visualization with status cards.
 * @sideEffects None; all movement is provided by CSS and disabled for reduced-motion preferences.
 */
export function CareNetworkVisual({ compact = false, className = "" }) {
  return (
    <div
      className={`care-network ${compact ? "care-network--compact" : ""} ${className}`}
      aria-hidden="true"
    >
      <div className="care-network__grid" />
      <svg className="care-network__links" viewBox="0 0 600 500" preserveAspectRatio="none">
        <path d="M300 240 C220 145 165 160 118 115" />
        <path d="M300 240 C390 145 440 165 490 112" />
        <path d="M300 240 C300 335 300 355 300 410" />
        <circle cx="300" cy="240" r="4" />
        <circle cx="118" cy="115" r="4" />
        <circle cx="490" cy="112" r="4" />
        <circle cx="300" cy="410" r="4" />
      </svg>

      <div className="care-node care-node--center">
        <span><HeartPulseIcon size={25} /></span>
        <strong>Care space</strong>
        <small>Connected now</small>
      </div>
      <div className="care-node care-node--family">
        <span><UsersIcon size={21} /></span>
        <strong>Family</strong>
        <small>London</small>
      </div>
      <div className="care-node care-node--caregiver">
        <span><CareIcon size={21} /></span>
        <strong>Caregiver</strong>
        <small>Dhaka</small>
      </div>
      <div className="care-node care-node--elderly">
        <span><ShieldCheckIcon size={21} /></span>
        <strong>Parent</strong>
        <small>At home</small>
      </div>

      <div className="network-update network-update--wellness">
        <ActivityIcon size={17} />
        <span><strong>Wellness updated</strong><small>Vitals look stable</small></span>
        <CheckIcon size={16} />
      </div>
      <div className="network-update network-update--alert">
        <BellIcon size={17} />
        <span><strong>Daily check-in</strong><small>Completed 8 min ago</small></span>
      </div>
    </div>
  );
}
