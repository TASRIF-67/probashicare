import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CloseIcon, MenuIcon } from "../Icons.jsx";
import { Logo } from "../Logo.jsx";
import { ThemeToggle } from "../ThemeToggle.jsx";

/** Displays responsive public navigation. @returns {import("react").ReactElement} Public header. @sideEffects Updates mobile-menu state. */
export function PublicHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  useEffect(() => {
    const sectionIds = [
      "platform",
      "how-it-works",
      "care-network",
      "plans",
    ];
    const sections = [];

    for (const sectionId of sectionIds) {
      const section = document.getElementById(sectionId);

      if (section) {
        sections.push(section);
      }
    }

    /**
     * Records the public section currently crossing the central viewport band.
     * @param {IntersectionObserverEntry[]} entries - Browser visibility updates.
     * @returns {void}
     * @sideEffects Updates the active public navigation state.
     */
    function handleSectionVisibility(entries) {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      }
    }

    const observer = new IntersectionObserver(handleSectionVisibility, {
      rootMargin: "-35% 0px -55% 0px",
      threshold: 0,
    });

    for (const section of sections) {
      observer.observe(section);
    }

    return function stopSectionObservation() {
      observer.disconnect();
    };
  }, []);

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
          <a
            href="#platform"
            aria-current={activeSection === "platform" ? "location" : undefined}
            onClick={closeMenu}
          >
            Platform
          </a>
          <a
            href="#how-it-works"
            aria-current={activeSection === "how-it-works" ? "location" : undefined}
            onClick={closeMenu}
          >
            How it works
          </a>
          <a
            href="#care-network"
            aria-current={activeSection === "care-network" ? "location" : undefined}
            onClick={closeMenu}
          >
            Care network
          </a>
          <a
            href="#plans"
            aria-current={activeSection === "plans" ? "location" : undefined}
            onClick={closeMenu}
          >
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
