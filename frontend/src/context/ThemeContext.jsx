import { createContext, useContext, useMemo, useState } from "react";

const ThemeContext = createContext(null);

/**
 * Provides persisted light/dark theme state.
 * @param {{children: import("react").ReactNode}} props - Descendant application tree.
 * @returns {import("react").ReactElement} Theme context provider.
 * @sideEffects Reads localStorage during initialization and updates DOM/localStorage on toggle.
 */
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || "light");

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

  const value = useMemo(() => ({ theme, toggleTheme }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Reads theme state from the nearest ThemeProvider.
 * @param {void} _unused - This hook accepts no arguments.
 * @returns {{theme: string, toggleTheme: () => void}} Theme name and toggle action.
 * @sideEffects None.
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider.");
  return context;
}
