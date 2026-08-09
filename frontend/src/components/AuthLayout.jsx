import { Link } from "react-router-dom";
import { CareNetworkVisual } from "./CareNetworkVisual.jsx";
import { Logo } from "./Logo.jsx";
import { ThemeToggle } from "./ThemeToggle.jsx";

/**
 * Provides the shared public authentication page shell.
 * @param {{children: import("react").ReactNode, eyebrow: string, title: string, description: string, trustItems?: string[], headerAccessory?: import("react").ReactNode}} props - Page content, introductory copy, trust labels, and optional header control.
 * @returns {import("react").ReactElement} Responsive two-column auth layout.
 * @sideEffects None.
 */
export function AuthLayout({
  children,
  eyebrow,
  title,
  description,
  trustItems = ["Private by design", "Built for families abroad"],
  headerAccessory = null,
}) {
  return (
    <main className="auth-shell">
      <div className="auth-aurora" aria-hidden="true"><span /><span /></div>
      <header className="topbar">
        <Logo />
        <div className="auth-header-actions">
          <Link className="auth-home-link" to="/">Home</Link>
          {headerAccessory}
          <ThemeToggle />
        </div>
      </header>
      <div className="auth-layout">
        <section className="auth-intro">
          <div className="auth-intro__copy">
            <span className="eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p>{description}</p>
            <div className="trust-row">
              {trustItems.map((item) => <span key={item}>{item}</span>)}
            </div>
          </div>
          <CareNetworkVisual compact />
        </section>
        <div className="auth-form-stage">{children}</div>
      </div>
    </main>
  );
}
