import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader.jsx";
import { Card } from "../../components/Card.jsx";
import { normalizeApiError } from "../../services/api.js";
import { elderlyProfileService } from "../../services/elderlyProfileService.js";
import { ChevronRightIcon, PlusIcon, UserPlusIcon } from "../../components/Icons.jsx";

/**
 * Calculates an approximate current age from a birth date.
 * @param {string|Date} dateOfBirth - Stored date of birth.
 * @returns {number} Completed years, never below zero.
 * @sideEffects None.
 */
function calculateAge(dateOfBirth) {
  return Math.max(0, Math.floor((Date.now() - new Date(dateOfBirth)) / 31557600000));
}

/**
 * Lists active elderly profiles linked to the current family.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Profile collection with navigation actions.
 * @sideEffects Loads profiles from the API on mount.
 */
export function ElderlyProfileListPage() {
  const [state, setState] = useState({ loading: true, profiles: [], error: "" });

  useEffect(() => {
    /**
     * Loads active profiles linked to the current family.
     * @returns {Promise<void>}
     * @sideEffects Reads the profile API and updates page state.
     */
    async function loadProfiles() {
      try {
        const data = await elderlyProfileService.listProfiles();

        setState({
          loading: false,
          profiles: data.profiles,
          error: "",
        });
      } catch (error) {
        const normalizedError = normalizeApiError(error);

        setState({
          loading: false,
          profiles: [],
          error: normalizedError.message,
        });
      }
    }

    loadProfiles();
  }, []);

  return (
    <main><AppHeader /><div className="feature-page"><div className="page-heading page-heading--action"><div><span className="eyebrow">Family records</span><h1>Elderly profiles</h1><p>Choose a relative to view or update their health information.</p></div><Link className="button button--primary" to="/elderly-profiles/new"><PlusIcon size={18} /> Create another profile</Link></div>
      {state.loading && <div className="page-loader-inline"><span className="spinner" /> Loading profiles</div>}
      {state.error && <div className="alert alert--error">{state.error}</div>}
      {!state.loading && !state.profiles.length && <Card className="empty-state"><span className="feature-icon"><UserPlusIcon /></span><h2>No profiles yet</h2><p>Create your first elderly profile to begin coordinating care.</p><Link className="button button--primary" to="/elderly-profiles/new"><PlusIcon size={18} /> Create profile</Link></Card>}
      <div className="profile-grid">{state.profiles.map((profile) => <Link className="profile-card" to={`/elderly-profiles/${profile._id}`} key={profile._id}><span className="profile-avatar">{profile.personalInformation.preferredName?.[0] || profile.personalInformation.fullName[0]}</span><div><span className="profile-card__relation">{profile.familyAccess.relationship}</span><h2>{profile.personalInformation.fullName}</h2><p>{calculateAge(profile.personalInformation.dateOfBirth)} years old · {profile.personalInformation.district}</p></div><div className="profile-card__meta"><span>{profile.medications.length} medications</span><span>{profile.allergies.length} allergies</span></div><ChevronRightIcon className="profile-card__arrow" size={20} /></Link>)}</div>
    </div></main>
  );
}
