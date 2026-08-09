import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Button } from "./Button.jsx";
import { Logo } from "./Logo.jsx";
import { ThemeToggle } from "./ThemeToggle.jsx";
import { CalendarIcon, DashboardIcon, LogOutIcon, UsersIcon } from "./Icons.jsx";

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
        <Link to="/dashboard"><DashboardIcon size={17} /> Dashboard</Link>
        <Link to="/caregivers"><UsersIcon size={17} /> Caregivers</Link>
        <Link to="/bookings"><CalendarIcon size={17} /> Bookings</Link>
        <Link to="/elderly-profiles"><UsersIcon size={17} /> Elderly profiles</Link>
      </nav>
      <div className="topbar__actions">
        <ThemeToggle />
        <Button variant="ghost" onClick={logout}><LogOutIcon size={17} /> Sign out</Button>
      </div>
    </header>
  );
}
