import { Logo } from "./Logo.jsx";
import { ThemeToggle } from "./ThemeToggle.jsx";

/**
 * Provides the shared public authentication page shell.
 * @param {{children: import("react").ReactNode, eyebrow: string, title: string, description: string}} props - Page content and introductory copy.
 * @returns {import("react").ReactElement} Responsive two-column auth layout.
 * @sideEffects None.
 */
export function AuthLayout({ children, eyebrow, title, description }) {
  return (
    <main className="auth-shell">
      <header className="topbar">
        <Logo />
        <ThemeToggle />
      </header>
      <div className="auth-layout">
        <section className="auth-intro">
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="trust-row">
            <span>Private by design</span>
            <span>Built for families abroad</span>
          </div>
        </section>
        {children}
      </div>
    </main>
  );
}
