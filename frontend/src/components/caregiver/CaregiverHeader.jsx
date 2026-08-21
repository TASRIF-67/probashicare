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
import { WorkspaceSearch } from "../WorkspaceSearch.jsx";

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
    to: "/caregiver/wellness-reports",
    label: "Reports",
    icon: ClipboardListIcon,
  },
];

const CAREGIVER_SECONDARY_LINKS = [
  {
    to: "/caregiver/tasks",
    label: "Care tasks",
    icon: ClipboardListIcon,
  },
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
  const navigationLinks = [
    ...CAREGIVER_PRIMARY_LINKS,
    ...CAREGIVER_SECONDARY_LINKS,
  ];

  return (
    <>
      <aside className="app-sidebar" aria-label="Caregiver workspace">
        <div className="app-sidebar__brand">
          <Logo />
          <span>Caregiver workspace</span>
        </div>
        {isApproved && (
          <>
            <nav className="app-side-nav" aria-label="Caregiver navigation">
              <span className="app-side-nav__label">Workspace</span>
              {navigationLinks.map((link) => {
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
              className="app-nav-menu--mobile"
              links={ALL_CAREGIVER_LINKS}
              label="Menu"
            />
          </>
        )}
        <div className="topbar__actions">
          <div className="app-sidebar__utilities app-sidebar__utilities--mobile">
            <NotificationBell />
            <ThemeToggle />
          </div>
          {isApproved && (
            <NavLink className="app-sidebar__user" to="/caregiver/profile">
              <span className="app-sidebar__avatar" aria-hidden="true">
                {user?.name?.[0] || "C"}
              </span>
              <span>
                <strong>{user?.name || "Caregiver"}</strong>
                <small>Approved caregiver</small>
              </span>
            </NavLink>
          )}
          <Button
            className="app-signout-button app-signout-button--mobile"
            variant="ghost"
            title="Sign out"
            onClick={logout}
          >
            <LogOutIcon size={17} />
            <span>Sign out</span>
          </Button>
        </div>
      </aside>

      <header className="app-workspace-bar">
        {isApproved ? (
          <WorkspaceSearch links={ALL_CAREGIVER_LINKS} />
        ) : (
          <div className="app-workspace-bar__label">
            Caregiver application workspace
          </div>
        )}
        <div className="app-workspace-bar__actions">
          <NotificationBell />
          <ThemeToggle />
          {isApproved && (
            <NavLink
              className="app-topbar-account"
              to="/caregiver/profile"
              aria-label="Open my caregiver profile"
              title={user?.name || "My profile"}
            >
              <span aria-hidden="true">
                {user?.name?.[0] || "C"}
              </span>
            </NavLink>
          )}
          <Button
            className="app-topbar-signout"
            variant="ghost"
            title="Sign out"
            onClick={logout}
          >
            <LogOutIcon size={17} />
            <span>Sign out</span>
          </Button>
        </div>
      </header>
    </>
  );
}
