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
  ShoppingBasketIcon,
  UserIcon,
  UsersIcon,
} from "./Icons.jsx";
import { NotificationBell } from "./notifications/NotificationBell.jsx";
import { NavigationMenu } from "./NavigationMenu.jsx";

const FAMILY_PRIMARY_LINKS = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: DashboardIcon,
  },
  {
    to: "/caregivers",
    label: "Caregivers",
    icon: UsersIcon,
  },
  {
    to: "/bookings",
    label: "Bookings",
    icon: CalendarIcon,
  },
  {
    to: "/doctor-appointments",
    label: "Doctor visits",
    icon: CalendarIcon,
  },
];

const FAMILY_SECONDARY_LINKS = [
  {
    to: "/groceries",
    label: "Essentials",
    icon: ShoppingBasketIcon,
  },
  {
    to: "/subscription",
    label: "Subscription",
    icon: ShieldCheckIcon,
  },
  {
    to: "/elderly-profiles",
    label: "Elderly profiles",
    icon: UsersIcon,
  },
];

const ALL_FAMILY_LINKS = [
  ...FAMILY_PRIMARY_LINKS,
  ...FAMILY_SECONDARY_LINKS,
];

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
      <nav
        className="app-nav app-nav--primary"
        aria-label="Family navigation"
      >
        {FAMILY_PRIMARY_LINKS.map((link) => {
          const LinkIcon = link.icon;

          return (
            <NavLink key={link.to} to={link.to}>
              <LinkIcon size={17} />
              {link.label}
            </NavLink>
          );
        })}
      </nav>
      <NavigationMenu
        className="app-nav-menu--desktop"
        links={FAMILY_SECONDARY_LINKS}
      />
      <NavigationMenu
        className="app-nav-menu--mobile"
        links={ALL_FAMILY_LINKS}
        label="Menu"
      />
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
        <Button variant="ghost" onClick={logout}>
          <LogOutIcon size={17} />
          Sign out
        </Button>
      </div>
    </header>
  );
}
