import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ActivityIcon,
  ArrowLeftIcon,
  BadgeCheckIcon,
  BellIcon,
  CalendarIcon,
  CheckIcon,
  ShieldCheckIcon,
} from "./Icons.jsx";
import { Logo } from "./Logo.jsx";
import { ThemeToggle } from "./ThemeToggle.jsx";
import "../styles/auth.css";
import { createRevealMotion } from "../utils/motion.js";

/**
 * Provides the shared public authentication page shell.
 * @param {object} props - Authentication layout properties.
 * @param {import("react").ReactNode} props.children - Login, signup, or verification content.
 * @param {string} props.eyebrow - Short label shown above the page title.
 * @param {string} props.title - Main authentication page title.
 * @param {string} props.description - Supporting explanation for the selected account type.
 * @param {string[]} [props.trustItems] - Short privacy or trust statements.
 * @param {import("react").ReactNode} [props.headerAccessory] - Optional account-mode selector.
 * @param {"family"|"caregiver"} [props.variant] - Role-specific color treatment.
 * @param {string[]} [props.processItems] - Account journey labels shown in the side panel.
 * @param {number} [props.activeProcessIndex] - Current account journey step.
 * @returns {import("react").ReactElement} A responsive authentication workspace.
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
  processItems = ["Secure access", "Verified identity", "Care workspace"],
  activeProcessIndex = 0,
}) {
  const reduceMotion = useReducedMotion();
  let safeVariant = "family";

  if (variant === "caregiver") {
    safeVariant = "caregiver";
  }

  return (
    <main className={`auth-shell auth-shell--${safeVariant}`}>
      <header className="auth-topbar">
        <Logo />
        <nav className="auth-header-actions" aria-label="Authentication navigation">
          <Link className="auth-home-link" to="/">
            <ArrowLeftIcon size={16} />
            Back to home
          </Link>
          <ThemeToggle />
        </nav>
      </header>

      <div className="auth-workspace">
        <motion.section
          className="auth-story"
          aria-labelledby="auth-page-title"
          {...createRevealMotion(reduceMotion, { distance: 16 })}
        >
          <div className="auth-story__copy">
            <span className="auth-eyebrow">{eyebrow}</span>
            <h1 id="auth-page-title">{title}</h1>
            <p>{description}</p>
          </div>

          <div className="auth-care-preview" aria-label="Example care workspace">
            <div className="auth-care-preview__header">
              <div>
                <span className="auth-care-preview__avatar" aria-hidden="true">
                  M
                </span>
                <span>
                  <strong>Masnun&apos;s care</strong>
                  <small>Dhaka, Bangladesh</small>
                </span>
              </div>
              <span className="auth-care-preview__status">
                <BadgeCheckIcon size={14} />
                All well
              </span>
            </div>

            <div className="auth-care-preview__grid">
              <div>
                <CalendarIcon aria-hidden="true" />
                <span>
                  <small>Next visit</small>
                  <strong>Tomorrow, 9:00 AM</strong>
                </span>
              </div>
              <div>
                <ActivityIcon aria-hidden="true" />
                <span>
                  <small>Latest update</small>
                  <strong>Vitals recorded</strong>
                </span>
              </div>
              <div>
                <BellIcon aria-hidden="true" />
                <span>
                  <small>Family status</small>
                  <strong>Up to date</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="auth-story__footer">
            <div className="auth-trust-list">
              {trustItems.map((item) => (
                <span key={item}>
                  <CheckIcon size={14} />
                  {item}
                </span>
              ))}
            </div>

            <ol className="auth-process" aria-label="Account process">
              {processItems.map((item, index) => {
                const isActive = index === activeProcessIndex;
                let className = "";

                if (isActive) {
                  className = "auth-process__item--active";
                }

                return (
                  <li
                    key={item}
                    className={className}
                    aria-current={isActive ? "step" : undefined}
                  >
                    <small>0{index + 1}</small>
                    <span>{item}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        </motion.section>

        <motion.section
          className="auth-access"
          aria-label="Secure account access"
          {...createRevealMotion(reduceMotion, {
            delay: 0.08,
            distance: 16,
          })}
        >
          <div className="auth-access__security">
            <span>
              <ShieldCheckIcon size={16} />
              Secure access
            </span>
            <small>Encrypted session</small>
          </div>

          {headerAccessory && (
            <div className="auth-access__mode">
              {headerAccessory}
            </div>
          )}

          <div className="auth-access__body">
            {children}
          </div>

          <p className="auth-access__privacy">
            Your information is only shared with authorized care participants.
          </p>
        </motion.section>
      </div>
    </main>
  );
}
