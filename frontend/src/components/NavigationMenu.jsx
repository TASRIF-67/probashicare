import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MenuIcon } from "./Icons.jsx";

/**
 * Checks whether the current page belongs to one of the supplied navigation links.
 * @param {string} pathname - Current browser route.
 * @param {Array<{to: string}>} links - Routes shown inside the menu.
 * @returns {boolean} True when one menu destination is active.
 * @sideEffects None.
 */
function hasActiveDestination(pathname, links) {
  for (const link of links) {
    if (pathname === link.to || pathname.startsWith(`${link.to}/`)) {
      return true;
    }
  }

  return false;
}

/**
 * Finds the visible label for the active dropdown destination.
 * @param {string} pathname - Current browser route.
 * @param {Array<{to: string, label: string}>} links - Routes shown inside the menu.
 * @returns {string} Active destination label, or an empty string when none match.
 * @sideEffects None.
 */
function getActiveDestinationLabel(pathname, links) {
  for (const link of links) {
    if (
      pathname === link.to
      || pathname.startsWith(link.to + "/")
    ) {
      return link.label;
    }
  }

  return "";
}

/**
 * Renders an accessible compact navigation menu for secondary or narrow-screen links.
 * @param {{links: Array<{to: string, label: string, icon: import("react").ComponentType<{size?: number}>}>, label?: string, className?: string}} props - Menu links, visible label, and optional style class.
 * @returns {import("react").ReactElement} Menu trigger and dropdown links.
 * @sideEffects Registers pointer and keyboard listeners while the menu is open.
 */
export function NavigationMenu({
  links,
  label = "More",
  className = "",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const location = useLocation();
  const containsActivePage = hasActiveDestination(
    location.pathname,
    links,
  );
  const activeDestinationLabel = getActiveDestinationLabel(
    location.pathname,
    links,
  );
  const visibleLabel = activeDestinationLabel || label;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    /**
     * Closes the menu after a click outside its container.
     * @param {PointerEvent} event - Browser pointer event.
     * @returns {void}
     * @sideEffects Updates local menu state.
     */
    function handleOutsidePointer(event) {
      if (
        menuRef.current
        && !menuRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    /**
     * Closes the menu when the Escape key is pressed.
     * @param {KeyboardEvent} event - Browser keyboard event.
     * @returns {void}
     * @sideEffects Updates local menu state.
     */
    function handleEscape(event) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsidePointer);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutsidePointer);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  /**
   * Toggles the dropdown visibility.
   * @returns {void}
   * @sideEffects Updates local menu state.
   */
  function toggleMenu() {
    setIsOpen((currentValue) => !currentValue);
  }

  /**
   * Closes the dropdown after navigation.
   * @returns {void}
   * @sideEffects Updates local menu state.
   */
  function closeMenu() {
    setIsOpen(false);
  }

  return (
    <div
      className={`app-nav-menu ${className}`.trim()}
      ref={menuRef}
    >
      <button
        className={
          containsActivePage
            ? "app-nav-menu__trigger app-nav-menu__trigger--active"
            : "app-nav-menu__trigger"
        }
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="true"
        onClick={toggleMenu}
      >
        <MenuIcon size={17} />
        <span>{visibleLabel}</span>
        <span
          className="app-nav-menu__chevron"
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <nav
          className="app-nav-menu__panel"
          aria-label={`${label} navigation`}
        >
          {links.map((link) => {
            const LinkIcon = link.icon;

            return (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={closeMenu}
              >
                <LinkIcon size={18} />
                <span>{link.label}</span>
              </NavLink>
            );
          })}
        </nav>
      )}
    </div>
  );
}
