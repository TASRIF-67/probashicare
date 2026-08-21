import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { Button } from "./Button.jsx";
import { Logo } from "./Logo.jsx";
import { ThemeToggle } from "./ThemeToggle.jsx";
import {
  ArrowRightIcon,
  CalendarIcon,
  DashboardIcon,
  CareTasksIcon,
  HeartPulseIcon,
  LogOutIcon,
  ShieldCheckIcon,
  ShoppingBasketIcon,
  UserIcon,
  UsersIcon,
  InsightsIcon,
} from "./Icons.jsx";
import { NotificationBell } from "./notifications/NotificationBell.jsx";
import { NavigationMenu } from "./NavigationMenu.jsx";
import { WorkspaceSearch } from "./WorkspaceSearch.jsx";
import { useSubscription } from "../context/SubscriptionContext.jsx";

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
    premiumValue: true,
  },
  {
    to: "/bookings",
    label: "Bookings",
    icon: CalendarIcon,
  },
];

const FAMILY_SECONDARY_LINKS = [
  {
    to: "/wellness",
    label: "Wellness & vitals",
    icon: HeartPulseIcon,
    premiumValue: true,
  },
  {
    to: "/care-tasks",
    label: "Care tasks",
    icon: CareTasksIcon,
  },
  {
    to: "/doctor-appointments",
    label: "Doctor visits",
    icon: CalendarIcon,
  },
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
  {
    to: "/account",
    label: "My account",
    icon: UserIcon,
  },
];

/**
 * Builds a short, honest account-access label from the backend subscription response.
 * @param {object|null} data - Shared subscription response.
 * @param {boolean} loading - Whether access is currently being checked.
 * @returns {{label: string, tone: "checking"|"free"|"trial"|"premium"|"expired"}} Visible plan label and style tone.
 * @sideEffects None.
 */
function getAccessPresentation(data, loading) {
  if (loading) {
    return {
      label: "Checking access",
      tone: "checking",
    };
  }

  const access = data?.access;
  const subscription = data?.subscription;

  if (access?.isPremium && subscription?.status === "trialing") {
    return {
      label: "Premium trial",
      tone: "trial",
    };
  }

  if (access?.isPremium) {
    const planName = subscription?.planSnapshot?.name || "Premium";
    return {
      label: "Premium · " + planName,
      tone: "premium",
    };
  }

  if (access?.status === "expired") {
    return {
      label: "Premium expired",
      tone: "expired",
    };
  }

  return {
    label: "Free plan",
    tone: "free",
  };
}

/**
 * Returns sidebar styling for an ordinary or Premium-value destination.
 * @param {{premiumValue?: boolean}} link - Navigation destination configuration.
 * @param {boolean} hasPremium - Whether Premium access is currently active.
 * @returns {string|undefined} Optional navigation class name.
 * @sideEffects None.
 */
function getNavigationClassName(link, hasPremium) {
  if (!link.premiumValue) {
    return undefined;
  }

  if (hasPremium) {
    return "app-side-nav__premium-link app-side-nav__premium-link--unlocked";
  }

  return "app-side-nav__premium-link";
}

/**
 * Renders authenticated family navigation and account actions.
 * @param {void} _unused - This component accepts no props.
 * @returns {import("react").ReactElement} Responsive application header.
 * @sideEffects Ends the session when Sign out is activated.
 */
export function AppHeader() {
  const { user, logout } = useAuth();
  const subscriptionState = useSubscription();
  const hasPremium = Boolean(subscriptionState.data?.access?.isPremium);
  const accessPresentation = getAccessPresentation(
    subscriptionState.data,
    subscriptionState.loading,
  );
  const navigationLinks = [
    ...FAMILY_PRIMARY_LINKS,
    ...FAMILY_SECONDARY_LINKS,
  ];

  return (
    <>
      <aside className="app-sidebar" aria-label="Family workspace">
        <div className="app-sidebar__brand">
          <Logo />
          <span>Family workspace</span>
        </div>
        <nav className="app-side-nav" aria-label="Family navigation">
          <span className="app-side-nav__label">Workspace</span>
          {navigationLinks.map((link) => {
            const LinkIcon = link.icon;

            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={getNavigationClassName(link, hasPremium)}
              >
                <LinkIcon size={17} />
                <span>{link.label}</span>
                {link.premiumValue && (
                  <span className="app-side-nav__feature-tag">
                    {hasPremium ? "Unlocked" : "Premium"}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>
        <NavLink
          className={`app-plan-chip app-plan-chip--mobile app-plan-chip--${accessPresentation.tone}`}
          to="/subscription"
          aria-label={`Subscription access: ${accessPresentation.label}`}
        >
          <ShieldCheckIcon size={15} />
          <span>{accessPresentation.label}</span>
        </NavLink>
        {!subscriptionState.loading && !hasPremium && (
          <section className="app-sidebar__upgrade" aria-label="Premium upgrade">
            <span className="app-sidebar__upgrade-icon" aria-hidden="true">
              <InsightsIcon size={17} />
            </span>
            <div>
              <strong>Unlock Premium</strong>
              <p>Booking tools, early alerts, summaries, and vital trends.</p>
            </div>
            <NavLink to="/subscription">
              View plans
              <ArrowRightIcon size={14} />
            </NavLink>
          </section>
        )}
        <NavigationMenu
          className="app-nav-menu--mobile"
          links={ALL_FAMILY_LINKS}
          label="Menu"
        />
        <div className="topbar__actions">
          <div className="app-sidebar__utilities app-sidebar__utilities--mobile">
            <NotificationBell />
            <ThemeToggle />
          </div>
          <NavLink className="app-sidebar__user" to="/account">
            <span className="app-sidebar__avatar" aria-hidden="true">
              {user?.name?.[0] || "F"}
            </span>
            <span>
              <strong>{user?.name || "Family member"}</strong>
              <small>{user?.email || "My account"}</small>
              <em className={`account-plan account-plan--${accessPresentation.tone}`}>
                {accessPresentation.label}
              </em>
            </span>
          </NavLink>
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
        <WorkspaceSearch links={ALL_FAMILY_LINKS} />
        <div className="app-workspace-bar__actions">
          <NavLink
            className={`app-plan-chip app-plan-chip--${accessPresentation.tone}`}
            to="/subscription"
          >
            <ShieldCheckIcon size={15} />
            <span>{accessPresentation.label}</span>
          </NavLink>
          <NotificationBell />
          <ThemeToggle />
          <NavLink
            className="app-topbar-account"
            to="/account"
            aria-label="Open my account"
            title={user?.name || "My account"}
          >
            <span aria-hidden="true">
              {user?.name?.[0] || "F"}
            </span>
          </NavLink>
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
