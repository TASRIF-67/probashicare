import { Link } from "react-router-dom";

/**
 * Explains a role-based access denial.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Unauthorized status page.
 * @sideEffects Navigates to the application root when selected.
 */
export function UnauthorizedPage() {
  return <main className="center-page"><h1>Access unavailable</h1><p>This account does not have permission to open that page.</p><Link className="button button--primary" to="/">Return home</Link></main>;
}
