import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  BriefcaseIcon,
  CalendarIcon,
  ClipboardListIcon,
  DashboardIcon,
  LogOutIcon,
} from "../Icons.jsx";
import { Button } from "../Button.jsx";
import { Logo } from "../Logo.jsx";
import { ThemeToggle } from "../ThemeToggle.jsx";
import { NotificationBell } from "../notifications/NotificationBell.jsx";

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
      {isApproved && (
        <nav className="app-nav" aria-label="Caregiver navigation">
          <NavLink to="/caregiver/dashboard">
            <DashboardIcon size={17} />
            Dashboard
          </NavLink>
          <NavLink to="/caregiver/bookings">
            <CalendarIcon size={17} />
            Bookings
          </NavLink>
          <NavLink to="/caregiver/wellness-reports">
            <ClipboardListIcon size={17} />
            Reports
          </NavLink>
          <NavLink to="/caregiver/profile">
            <BriefcaseIcon size={17} />
            My profile
          </NavLink>
        </nav>
      )}
      <div className="topbar__actions">
        <NotificationBell />
        <ThemeToggle />
        <Button variant="ghost" onClick={logout}>
          <LogOutIcon size={17} />
          Sign out
        </Button>
      </div>
    </header>
  );
}
