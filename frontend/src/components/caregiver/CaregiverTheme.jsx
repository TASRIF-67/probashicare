import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { useTheme } from "../../context/ThemeContext.jsx";

/**
 * Applies the caregiver accent tokens while preserving the shared layout and neutral palette.
 * @param {{children: import("react").ReactNode}} props - Caregiver-facing page content.
 * @returns {import("react").ReactElement} Scoped caregiver theme wrapper.
 * @sideEffects None; CSS custom properties are scoped to the rendered subtree.
 */
export function CaregiverTheme({ children }) {
  const { setAccentMode } = useTheme();
  useEffect(() => {
    setAccentMode("caregiver");
    return () => setAccentMode("family");
  }, [setAccentMode]);
  return <>{children}</>;
}

/**
 * Applies caregiver accent tokens to nested protected React Router routes.
 * @param {void} _unused - This route wrapper accepts no props.
 * @returns {import("react").ReactElement} Scoped wrapper containing the nested route outlet.
 * @sideEffects Renders the active nested route through React Router.
 */
export function CaregiverThemeRoute() {
  return <CaregiverTheme><Outlet /></CaregiverTheme>;
}
