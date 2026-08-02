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
      <header className="topbar">
        <Logo />
        <div className="auth-header-actions">{headerAccessory}<ThemeToggle /></div>
      </header>
      <div className="auth-layout">
        <section className="auth-intro">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="trust-row">
            {trustItems.map((item) => <span key={item}>{item}</span>)}
          </div>
        </section>
        {children}
      </div>
    </main>
  );
}
