import { Link } from "react-router-dom";
import {
  ArrowLeftIcon,
  CheckIcon,
  ShieldCheckIcon,
} from "./Icons.jsx";
import { Logo } from "./Logo.jsx";
import { ThemeToggle } from "./ThemeToggle.jsx";
import "../styles/auth.css";

const DEFAULT_PROCESS_ITEMS = [
  "Secure access",
  "Verified identity",
  "Care workspace",
];

/**
 * Provides the shared public authentication page shell.
 * @param {{children: import("react").ReactNode, eyebrow: string, title: string, description: string, trustItems?: string[], headerAccessory?: import("react").ReactNode, variant?: "family"|"caregiver", processItems?: string[], activeProcessIndex?: number}} props - Authentication content and role-aware presentation values.
 * @returns {import("react").ReactElement} A calm responsive authentication layout.
 * @sideEffects React Router links navigate when activated.
 */
export function AuthLayout({
  children,
  eyebrow,
  title,
  description,
  trustItems = ["Private by design", "Built for families abroad"],
  headerAccessory = null,
  variant = "family",
  processItems = DEFAULT_PROCESS_ITEMS,
  activeProcessIndex = 0,
}) {
  const safeVariant = variant === "caregiver"
    ? "caregiver"
    : "family";

  return (
    <main className={`auth-shell auth-shell--${safeVariant}`}>
      <header className="topbar auth-topbar">
        <Logo />
        <nav className="auth-header-actions" aria-label="Authentication navigation">
          <Link className="auth-home-link" to="/">
            <ArrowLeftIcon size={15} />
            Home
          </Link>
          <ThemeToggle />
        </nav>
      </header>

      <div className="auth-simple-layout">
        <section className="auth-simple-intro" aria-labelledby="auth-page-title">
          <span className="eyebrow">{eyebrow}</span>
          <h1 id="auth-page-title">{title}</h1>
          <p>{description}</p>

          <div className="auth-trust-list">
            {trustItems.map((item) => (
              <span key={item}>
                <CheckIcon size={14} />
                {item}
              </span>
            ))}
          </div>

          <div className="auth-care-line" aria-hidden="true">
            <span>Family</span>
            <i />
            <span>Care space</span>
            <i />
            <span>Care at home</span>
          </div>

          <ol className="auth-process" aria-label="Account process">
            {processItems.map((item, index) => {
              const isActive = index === activeProcessIndex;

              return (
                <li
                  key={item}
                  className={isActive ? "auth-process__item--active" : undefined}
                  aria-current={isActive ? "step" : undefined}
                >
                  <small>0{index + 1}</small>
                  <span>{item}</span>
                </li>
              );
            })}
          </ol>
        </section>

        <section className="auth-simple-access" aria-label="Secure account access">
          {headerAccessory && (
            <div className="auth-access__mode">
              {headerAccessory}
            </div>
          )}

          <div className="auth-access__header">
            <span>
              <ShieldCheckIcon size={15} />
              Secure account access
            </span>
            <small>Encrypted session</small>
          </div>

          <div className="auth-access__body">
            {children}
          </div>

          <p className="auth-access__privacy">
            Your information is used only for authorized care coordination.
          </p>
        </section>
      </div>
    </main>
  );
}
