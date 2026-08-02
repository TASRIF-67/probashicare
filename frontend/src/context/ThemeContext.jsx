import { createContext, useContext, useMemo, useState } from "react";

const ThemeContext = createContext(null);

/**
 * Provides persisted light/dark state and the current role-surface accent.
 * @param {{children: import("react").ReactNode}} props - Descendant application tree.
 * @returns {import("react").ReactElement} Theme context provider.
 * @sideEffects Reads localStorage during initialization and updates DOM/localStorage on toggle.
 */
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "light");
  const [accentMode, setAccentMode] = useState(() => {
    const location = new URL(window.location.href);
    return location.pathname.startsWith("/caregiver") || location.searchParams.get("mode") === "caregiver"
      ? "caregiver"
      : "family";
  });

  /**
   * Switches the active theme and persists the preference.
   * @param {void} _unused - This function accepts no arguments.
   * @returns {void}
   * @sideEffects Mutates the root data attribute and localStorage.
   */
  function toggleTheme() {
    setTheme((current) => {
      const next = current === "light" ? "dark" : "light";
      document.documentElement.dataset.theme = next;
      localStorage.setItem("probashicare-theme", next);
      return next;
    });
  }

  const value = useMemo(
    () => ({ theme, toggleTheme, accentMode, setAccentMode }),
    [theme, accentMode],
  );
  return (
    <ThemeContext.Provider value={value}>
      <div className={accentMode === "caregiver" ? "caregiver-theme" : "family-theme"}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

/**
 * Reads theme state from the nearest ThemeProvider.
 * @param {void} _unused - This hook accepts no arguments.
 * @returns {{theme: string, toggleTheme: () => void, accentMode: "family"|"caregiver", setAccentMode: (mode: "family"|"caregiver") => void}} Theme and role-surface accent controls.
 * @sideEffects None.
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider.");
  return context;
}
