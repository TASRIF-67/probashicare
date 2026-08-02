import { Link } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.jsx";
import { Card } from "../components/Card.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { ArrowRightIcon, UsersIcon } from "../components/Icons.jsx";

/**
 * Renders the protected family dashboard placeholder.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Family-only dashboard shell.
 * @sideEffects Navigates to linked profile management when selected.
 */
export function DashboardPage() {
  const { user } = useAuth();
  return <main><AppHeader /><div className="simple-page"><span className="eyebrow">Family dashboard</span><h1>Good to see you, {user.name}.</h1><Card><span className="feature-icon"><UsersIcon /></span><h2>Family health profiles</h2><p>Review personal information, medical history, allergies, medications, chronic diseases, and emergency contacts.</p><Link className="button button--primary" to="/elderly-profiles">View elderly profiles <ArrowRightIcon size={18} /></Link></Card></div></main>;
}
