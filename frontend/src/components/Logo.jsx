import { Link } from "react-router-dom";

/**
 * Renders the ProbashiCare wordmark and home link.
 * @param {void} _unused - This component accepts no props.
 * @returns {import("react").ReactElement} Linked brand mark.
 * @sideEffects Navigates through React Router when activated.
 */
export function Logo() {
  return (
    <Link className="logo" to="/">
      <span className="logo__mark">P</span>
      <span>ProbashiCare</span>
    </Link>
  );
}
