import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeftIcon,
  BadgeCheckIcon,
  HeartPulseIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "./Icons.jsx";
import { Logo } from "./Logo.jsx";
import { ThemeToggle } from "./ThemeToggle.jsx";
import "../styles/auth.css";
import { createRevealMotion } from "../utils/motion.js";

/** Shared account layout. Authentication actions stay in the page components. */
export function AuthLayout({
  children,
  title,
  description,
  headerAccessory = null,
  variant = "family",
}) {
  const reduceMotion = useReducedMotion();
  const safeVariant = variant === "caregiver" ? "caregiver" : "family";

  return (
    <main className={`auth-shell auth-shell--refined auth-shell--${safeVariant}`}>
      <header className="auth-topbar">
        <Logo />
        <nav className="auth-header-actions" aria-label="Authentication navigation">
          <Link className="auth-home-link" to="/">
            <ArrowLeftIcon size={16} aria-hidden="true" />
            Home
          </Link>
          <ThemeToggle />
        </nav>
      </header>

      <div className="auth-workspace">
        <motion.section
          className="auth-story"
          aria-labelledby="auth-page-title"
          {...createRevealMotion(reduceMotion, { distance: 12 })}
        >
          <div className="auth-story__copy">
            <h1 id="auth-page-title">{title}</h1>
            <p>{description}</p>
          </div>

          <div className="auth-care-art" role="img" aria-label="Family, loved ones, and caregivers connected through care">
            <div className="auth-care-art__orbit auth-care-art__orbit--outer" />
            <div className="auth-care-art__orbit auth-care-art__orbit--inner" />
            <div className="auth-care-art__center"><HeartPulseIcon size={44} strokeWidth={1.4} /></div>
            <span className="auth-care-art__dot auth-care-art__dot--one" />
            <span className="auth-care-art__dot auth-care-art__dot--two" />
            <div className="auth-care-art__person auth-care-art__person--family">
              <span><UsersIcon size={23} strokeWidth={1.6} /></span>
              <div><strong>Family</strong><small>Near or far</small></div>
            </div>
            <div className="auth-care-art__person auth-care-art__person--loved-one">
              <span><HeartPulseIcon size={23} strokeWidth={1.6} /></span>
              <div><strong>Your loved ones</strong><small>At the heart of it all</small></div>
            </div>
            <div className="auth-care-art__person auth-care-art__person--caregiver">
              <span><BadgeCheckIcon size={23} strokeWidth={1.6} /></span>
              <div><strong>Caregivers</strong><small>Here to help</small></div>
            </div>
          </div>

          <div className="auth-story__caption">
            <span className="auth-story__caption-icon"><ShieldCheckIcon size={20} strokeWidth={1.7} /></span>
            <div><strong>Care is personal. We keep it that way.</strong><p>Shared only with the people involved in your care.</p></div>
          </div>
        </motion.section>

        <motion.section
          className="auth-access"
          aria-label="Account access"
          {...createRevealMotion(reduceMotion, { delay: 0.06, distance: 12 })}
        >
          {headerAccessory && <div className="auth-access__mode">{headerAccessory}</div>}
          <div className="auth-access__body">{children}</div>
          <p className="auth-access__privacy"><ShieldCheckIcon size={15} aria-hidden="true" />Private access to your care space</p>
        </motion.section>
      </div>
      <footer className="auth-page-footer">ProbashiCare<span>Care for the people you call home.</span></footer>
    </main>
  );
}
