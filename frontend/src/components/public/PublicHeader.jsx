import { useState } from "react";
import { Link } from "react-router-dom";
import { CloseIcon, MenuIcon } from "../Icons.jsx";
import { Logo } from "../Logo.jsx";
import { ThemeToggle } from "../ThemeToggle.jsx";

/** Displays responsive public navigation. @returns {import("react").ReactElement} Public header. @sideEffects Updates mobile-menu state. */
export function PublicHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  /** Closes the mobile menu. @returns {void} No value. @sideEffects Updates local state. */
  function closeMenu() {
    setIsMenuOpen(false);
  }

  /** Toggles the mobile menu. @returns {void} No value. @sideEffects Updates local state. */
  function toggleMenu() {
    setIsMenuOpen(!isMenuOpen);
  }

  return (
    <header className="public-header">
      <div className="public-container public-header__inner">
        <Logo />
        <nav
          id="public-navigation"
          className={isMenuOpen ? "public-nav public-nav--open" : "public-nav"}
          aria-label="Main navigation"
        >
          <a href="#platform" onClick={closeMenu}>
            Platform
          </a>
          <a href="#how-it-works" onClick={closeMenu}>
            How it works
          </a>
          <a href="#care-network" onClick={closeMenu}>
            Care network
          </a>
          <a href="#plans" onClick={closeMenu}>
            Plans
          </a>
        </nav>
        <div className="public-header__actions">
          <ThemeToggle />
          <Link className="public-sign-in" to="/login">Sign in</Link>
          <Link className="button public-header__cta" to="/signup">Get started</Link>
          <button
            className="public-menu-button"
            type="button"
            aria-expanded={isMenuOpen}
            aria-controls="public-navigation"
            aria-label={isMenuOpen ? "Close navigation" : "Open navigation"}
            onClick={toggleMenu}
          >
            {isMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>
    </header>
  );
}
