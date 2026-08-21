import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader.jsx";
import { FamilyTaskPlanner } from "../../components/FamilyTaskPlanner.jsx";
import {
  ArrowLeftIcon,
  CareTasksIcon,
  ShieldCheckIcon,
} from "../../components/Icons.jsx";
import { normalizeApiError } from "../../services/api.js";
import { elderlyProfileService } from "../../services/elderlyProfileService.js";

/**
 * Displays a focused family workspace for planning one elderly profile's visit tasks.
 * @param {void} _unused - Route parameters provide the elderly profile identifier.
 * @returns {import("react").ReactElement} Dedicated care-task planning page.
 * @sideEffects Loads an authorized elderly profile and renders the API-backed task planner.
 */
export function ElderlyCareTasksPage() {
  const { profileId } = useParams();
  const [state, setState] = useState({
    loading: true,
    profile: null,
    error: "",
  });

  useEffect(() => {
    let active = true;

    /**
     * Loads the authorized profile needed for task-page identity.
     * @returns {Promise<void>} Resolves after the page state is updated.
     * @sideEffects Calls the elderly-profile API and updates React state.
     */
    async function loadProfile() {
      try {
        const data = await elderlyProfileService.getProfile(profileId);

        if (active) {
          setState({
            loading: false,
            profile: data.profile,
            error: "",
          });
        }
      } catch (error) {
        if (active) {
          setState({
            loading: false,
            profile: null,
            error: normalizeApiError(error).message,
          });
        }
      }
    }

    loadProfile();

    return function stopProfileLoad() {
      active = false;
    };
  }, [profileId]);

  if (state.loading) {
    return (
      <main>
        <AppHeader />
        <div className="page-loader">
          <span className="spinner" />
          Loading care-task workspace
        </div>
      </main>
    );
  }

  if (state.error || !state.profile) {
    return (
      <main>
        <AppHeader />
        <div className="center-page">
          <CareTasksIcon />
          <h1>Care tasks unavailable</h1>
          <p>{state.error || "This elderly profile could not be loaded."}</p>
          <Link className="button button--secondary" to="/elderly-profiles">
            <ArrowLeftIcon size={17} />
            Return to profiles
          </Link>
        </div>
      </main>
    );
  }

  const personal = state.profile.personalInformation;
  const profileName = personal.preferredName || personal.fullName;

  return (
    <main>
      <AppHeader />
      <div className="feature-page family-care-tasks-page">
        <Link
          className="profile-back-link"
          to="/care-tasks"
        >
          <ArrowLeftIcon size={17} />
          All care-task profiles
        </Link>

        <header className="family-care-tasks-hero">
          <div>
            <span className="eyebrow">Care coordination</span>
            <h1>Visit tasks for {profileName}</h1>
            <p>
              Give assigned caregivers a short, practical checklist for their
              upcoming care visits.
            </p>
          </div>
          <div className="family-care-tasks-hero__note">
            <ShieldCheckIcon />
            <div>
              <strong>Assigned caregivers only</strong>
              <span>
                Tasks are shown only to the caregiver connected to the visit.
              </span>
            </div>
          </div>
        </header>

        <FamilyTaskPlanner
          elderlyProfileId={profileId}
          elderlyName={profileName}
        />
      </div>
    </main>
  );
}
