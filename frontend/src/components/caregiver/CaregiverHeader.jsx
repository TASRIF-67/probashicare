import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { BriefcaseIcon, ClipboardListIcon, DashboardIcon, LogOutIcon } from "../Icons.jsx";
import { Button } from "../Button.jsx";
import { Logo } from "../Logo.jsx";
import { ThemeToggle } from "../ThemeToggle.jsx";

/**
 * Renders caregiver navigation appropriate to the current application status.
 * @param {void} _unused - This component accepts no props.
 * @returns {import("react").ReactElement} Caregiver application/dashboard header.
 * @sideEffects Ends the current session when Sign out is activated.
 */
export function CaregiverHeader() {
  const { user, logout } = useAuth();
  const isApproved = user.caregiverApplicationStatus === "approved";
  return (
    <header className="topbar app-topbar">
      <Logo />
      {isApproved && <nav className="app-nav" aria-label="Caregiver navigation"><Link to="/caregiver/dashboard"><DashboardIcon size={17} /> Dashboard</Link><Link to="/caregiver/wellness-reports"><ClipboardListIcon size={17} /> Reports</Link><Link to="/caregiver/profile"><BriefcaseIcon size={17} /> My profile</Link></nav>}
      <div className="topbar__actions"><ThemeToggle /><Button variant="ghost" onClick={logout}><LogOutIcon size={17} /> Sign out</Button></div>
    </header>
  );
}
