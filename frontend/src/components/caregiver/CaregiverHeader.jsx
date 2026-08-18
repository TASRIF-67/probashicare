import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import {
  BriefcaseIcon,
  CalendarIcon,
  ClipboardListIcon,
  DashboardIcon,
  LogOutIcon,
  StarIcon,
  ShoppingBasketIcon,
} from "../Icons.jsx";
import { Button } from "../Button.jsx";
import { Logo } from "../Logo.jsx";
import { ThemeToggle } from "../ThemeToggle.jsx";
import { NotificationBell } from "../notifications/NotificationBell.jsx";
import { NavigationMenu } from "../NavigationMenu.jsx";

const CAREGIVER_PRIMARY_LINKS = [
  {
    to: "/caregiver/dashboard",
    label: "Dashboard",
    icon: DashboardIcon,
  },
  {
    to: "/caregiver/bookings",
    label: "Bookings",
    icon: CalendarIcon,
  },
  {
    to: "/caregiver/tasks",
    label: "Tasks",
    icon: ClipboardListIcon,
  },
  {
    to: "/caregiver/wellness-reports",
    label: "Reports",
    icon: ClipboardListIcon,
  },
];

const CAREGIVER_SECONDARY_LINKS = [
  {
    to: "/caregiver/doctor-visits",
    label: "Doctor visits",
    icon: CalendarIcon,
  },
  {
    to: "/caregiver/groceries",
    label: "Essentials",
    icon: ShoppingBasketIcon,
  },
  {
    to: "/caregiver/reviews",
    label: "Reviews",
    icon: StarIcon,
  },
  {
    to: "/caregiver/profile",
    label: "My profile",
    icon: BriefcaseIcon,
  },
];

const ALL_CAREGIVER_LINKS = [
  ...CAREGIVER_PRIMARY_LINKS,
  ...CAREGIVER_SECONDARY_LINKS,
];

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
        <>
          <nav
            className="app-nav app-nav--primary"
            aria-label="Caregiver navigation"
          >
            {CAREGIVER_PRIMARY_LINKS.map((link) => {
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
            links={CAREGIVER_SECONDARY_LINKS}
          />
          <NavigationMenu
            className="app-nav-menu--mobile"
            links={ALL_CAREGIVER_LINKS}
            label="Menu"
          />
        </>
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
