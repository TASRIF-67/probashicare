import { Link } from "react-router-dom";
import { AppHeader } from "../components/AppHeader.jsx";
import { Card } from "../components/Card.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { ArrowRightIcon, UserPlusIcon } from "../components/Icons.jsx";

/**
 * Presents the handoff into the upcoming Elderly Health Profile module.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Family onboarding prompt.
 * @sideEffects Navigates to elderly profile creation when selected.
 */
export function OnboardingPage() {
  const { user } = useAuth();
  return (
    <main>
      <AppHeader />
      <div className="onboarding">
        <span className="eyebrow">Welcome, {user.name}</span>
        <h1>Who will you be caring for?</h1>
        <p>Start by creating an elderly profile. You will be able to add more family members later.</p>
        <Card className="onboarding-card">
          <div className="profile-placeholder"><UserPlusIcon size={25} /></div>
          <div><h2>Create an elderly profile</h2><p>Add essential details, health context, and care preferences in the next step.</p></div>
          <Link className="button button--primary" to="/elderly-profiles/new">Get started <ArrowRightIcon size={18} /></Link>
        </Card>
      </div>
    </main>
  );
}
