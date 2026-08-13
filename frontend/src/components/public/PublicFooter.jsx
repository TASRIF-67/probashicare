import { Link } from "react-router-dom";
import { Logo } from "../Logo.jsx";

/** Displays the public footer. @returns {import("react").ReactElement} Public footer. @sideEffects Router links navigate when activated. */
export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-container public-footer__inner">
        <div className="public-footer__brand"><Logo /><p>Care coordination that keeps families close, wherever life takes them.</p></div>
        <nav className="public-footer__links" aria-label="Footer navigation">
          <a href="#platform">Platform</a><a href="#how-it-works">How it works</a><Link to="/caregiver/signup">Become a caregiver</Link><Link to="/login">Sign in</Link>
        </nav>
      </div>
      <div className="public-container public-footer__bottom"><span>ProbashiCare</span><span>Designed for dependable elderly care coordination.</span></div>
    </footer>
  );
}
