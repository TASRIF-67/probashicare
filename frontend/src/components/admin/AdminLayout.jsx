import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { BriefcaseIcon, ClipboardListIcon, CloseIcon, DashboardIcon, LogOutIcon, MenuIcon, MoneyIcon, StarIcon, UsersIcon } from "../Icons.jsx";
import { Logo } from "../Logo.jsx";
import { ThemeToggle } from "../ThemeToggle.jsx";

const ADMIN_NAVIGATION = [
  { to: "/admin", label: "Overview", icon: DashboardIcon, end: true },
  { to: "/admin/accounts", label: "Family accounts", icon: UsersIcon, end: false },
  { to: "/admin/bookings", label: "Bookings", icon: ClipboardListIcon, end: false },
  { to: "/admin/feedback", label: "Ratings & complaints", icon: StarIcon, end: false },
  { to: "/admin/payments", label: "Transactions", icon: MoneyIcon, end: false },
  { to: "/admin/caregivers", label: "Caregiver applications", icon: BriefcaseIcon, end: false },
];

/**
 * Provides persistent admin navigation, identity controls, and nested page content.
 * @param {void} _unused - This layout accepts no props.
 * @returns {import("react").ReactElement} Responsive admin application shell.
 * @sideEffects Opens/closes mobile navigation and may end the admin session.
 */
export function AdminLayout() {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const { user, logout } = useAuth();

  /**
   * Closes the mobile navigation after selecting a destination.
   * @param {void} _unused - This function accepts no arguments.
   * @returns {void}
   * @sideEffects Updates local navigation state.
   */
  function closeNavigation() {
    setIsNavigationOpen(false);
  }

  return (
    <main className="admin-app">
      <aside className={`admin-sidebar ${isNavigationOpen ? "admin-sidebar--open" : ""}`}>
        <div className="admin-sidebar__brand">
          <Logo />
          <button className="icon-button admin-sidebar__close" type="button" onClick={closeNavigation} aria-label="Close navigation">
            <CloseIcon size={19} />
          </button>
        </div>
        <div className="admin-sidebar__label">Workspace</div>
        <nav className="admin-sidebar__nav" aria-label="Admin navigation">
          {ADMIN_NAVIGATION.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              to={to}
              end={end}
              onClick={closeNavigation}
              className={({ isActive }) => (isActive ? "admin-nav-link admin-nav-link--active" : "admin-nav-link")}
              key={to}
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="admin-sidebar__footer">
          <span className="admin-identity__avatar">{user.name[0]}</span>
          <span><strong>{user.name}</strong><small>Administrator</small></span>
        </div>
      </aside>
      {isNavigationOpen && <button className="admin-sidebar-backdrop" type="button" aria-label="Close navigation" onClick={closeNavigation} />}
      <section className="admin-workspace">
        <header className="admin-workspace__topbar">
          <button className="icon-button admin-menu-button" type="button" onClick={() => setIsNavigationOpen(true)} aria-label="Open navigation">
            <MenuIcon />
          </button>
          <div className="admin-workspace__title">
            <span>ProbashiCare</span>
            <small>Platform administration</small>
          </div>
          <div className="admin-workspace__actions">
            <div className="admin-topbar-user"><span className="admin-identity__avatar">{user.name[0]}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></div>
            <ThemeToggle />
            <button className="icon-button admin-action" type="button" onClick={logout} aria-label="Sign out" title="Sign out">
              <LogOutIcon />
            </button>
          </div>
        </header>
        <div className="admin-workspace__content">
          <Outlet />
        </div>
      </section>
    </main>
  );
}
