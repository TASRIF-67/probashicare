import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Button } from "./Button.jsx";
import { Logo } from "./Logo.jsx";
import { ThemeToggle } from "./ThemeToggle.jsx";
import {
  CalendarIcon,
  DashboardIcon,
  LogOutIcon,
  ShieldCheckIcon,
  UserIcon,
  UsersIcon,
} from "./Icons.jsx";
import { NotificationBell } from "./notifications/NotificationBell.jsx";

/**
 * Renders authenticated family navigation and account actions.
 * @param {void} _unused - This component accepts no props.
 * @returns {import("react").ReactElement} Responsive application header.
 * @sideEffects Ends the session when Sign out is activated.
 */
export function AppHeader() {
  const { logout } = useAuth();
  return (
    <header className="topbar app-topbar">
      <Logo />
      <nav className="app-nav" aria-label="Family navigation">
        <NavLink to="/dashboard"><DashboardIcon size={17} /> Dashboard</NavLink>
        <NavLink to="/caregivers"><UsersIcon size={17} /> Caregivers</NavLink>
        <NavLink to="/bookings"><CalendarIcon size={17} /> Bookings</NavLink>
        <NavLink to="/doctor-appointments"><CalendarIcon size={17} /> Doctor visits</NavLink>
        <NavLink to="/subscription"><ShieldCheckIcon size={17} /> Subscription</NavLink>
        <NavLink to="/elderly-profiles"><UsersIcon size={17} /> Elderly profiles</NavLink>
      </nav>
      <div className="topbar__actions">
        <NavLink
          className="icon-button"
          to="/account"
          aria-label="My account"
          title="My account"
        >
          <UserIcon size={18} />
        </NavLink>
        <NotificationBell />
        <ThemeToggle />
        <Button variant="ghost" onClick={logout}><LogOutIcon size={17} /> Sign out</Button>
      </div>
    </header>
  );
}
