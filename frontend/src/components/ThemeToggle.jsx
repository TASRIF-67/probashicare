import { useTheme } from "../context/ThemeContext.jsx";
import { MoonIcon, SunIcon } from "./Icons.jsx";

/**
 * Renders the persisted color-theme switch.
 * @param {void} _unused - This component accepts no props.
 * @returns {import("react").ReactElement} Theme toggle button.
 * @sideEffects Changes and persists the active theme when clicked.
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      className="theme-toggle icon-button"
      onClick={toggleTheme}
      aria-label={`Use ${theme === "light" ? "dark" : "light"} mode`}
      title={`Use ${theme === "light" ? "dark" : "light"} mode`}
    >
      {theme === "light" ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
