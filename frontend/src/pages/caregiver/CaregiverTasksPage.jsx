import { useEffect, useState } from "react";
import { Card } from "../../components/Card.jsx";
import { CaregiverHeader } from "../../components/caregiver/CaregiverHeader.jsx";
import { CaregiverChecklist } from "../../components/CaregiverChecklist.jsx";
import {
  CareTasksIcon,
  UserIcon,
} from "../../components/Icons.jsx";
import { bookingService } from "../../services/bookingService.js";
import { normalizeApiError } from "../../services/api.js";

/**
 * Builds one unique profile option for every accepted caregiver booking.
 * @param {object[]} bookings - Caregiver booking response records.
 * @returns {{id: string, name: string}[]} Unique assigned elderly profiles.
 * @sideEffects None.
 */
function buildAssignedProfiles(bookings) {
  const profiles = [];

  for (const booking of bookings) {
    const hasActiveStatus =
      booking.status === "accepted" || booking.status === "confirmed";

    if (!hasActiveStatus) {
      continue;
    }

    const profileId =
      booking.elderlyProfileId?.toString?.() ||
      booking.elderlyProfile?._id;
    const profileName = booking.elderlyProfile?.name || "Care recipient";

    if (!profileId) {
      continue;
    }

    let alreadyIncluded = false;

    for (const profile of profiles) {
      if (String(profile.id) === String(profileId)) {
        alreadyIncluded = true;
        break;
      }
    }

    if (!alreadyIncluded) {
      profiles.push({
        id: profileId,
        name: profileName,
      });
    }
  }

  return profiles;
}

/**
 * Displays caregiver task lists separated by assigned elderly profile.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Caregiver task workspace.
 * @sideEffects Loads caregiver bookings and renders API-backed task checklists.
 */
export function CaregiverTasksPage() {
  const [state, setState] = useState({
    loading: true,
    profiles: [],
    error: "",
  });
  const [selectedProfileId, setSelectedProfileId] = useState("");

  useEffect(() => {
    let active = true;

    /**
     * Loads active caregiver assignments used to separate task lists.
     * @returns {Promise<void>} Resolves after assignment state is prepared.
     * @sideEffects Calls the booking API and updates React state.
     */
    async function loadAssignedProfiles() {
      try {
        const result = await bookingService.listCaregiverBookings();
        const profiles = buildAssignedProfiles(result.bookings || []);

        if (active) {
          setState({
            loading: false,
            profiles,
            error: "",
          });
          setSelectedProfileId(profiles[0]?.id || "");
        }
      } catch (requestError) {
        if (active) {
          setState({
            loading: false,
            profiles: [],
            error: normalizeApiError(requestError).message,
          });
        }
      }
    }

    loadAssignedProfiles();

    return function stopAssignmentLoad() {
      active = false;
    };
  }, []);

  /**
   * Opens the checklist for one assigned elderly profile.
   * @param {string} profileId - ElderlyProfile identifier.
   * @returns {void}
   * @sideEffects Updates the selected profile state.
   */
  function selectProfile(profileId) {
    setSelectedProfileId(profileId);
  }

  let selectedProfile = null;

  for (const profile of state.profiles) {
    if (String(profile.id) === String(selectedProfileId)) {
      selectedProfile = profile;
      break;
    }
  }

  if (!selectedProfile && state.profiles[0]) {
    selectedProfile = state.profiles[0];
  }

  return (
    <main>
      <CaregiverHeader />
      <div className="caregiver-page caregiver-task-page">
        <header className="caregiver-task-hero">
          <div>
            <span className="eyebrow">Visit preparation</span>
            <h1>Care task checklist</h1>
            <p>
              Review family instructions and update each item during the
              correct care recipient&apos;s visit.
            </p>
          </div>
          <span className="caregiver-task-hero__icon">
            <CareTasksIcon />
          </span>
        </header>

        {state.loading && (
          <div className="page-loader-inline">
            <span className="spinner" />
            Loading assigned profiles
          </div>
        )}

        {state.error && <div className="alert alert--error">{state.error}</div>}

        {!state.loading && !state.error && state.profiles.length === 0 && (
          <Card className="caregiver-task-page__empty">
            <span><CareTasksIcon /></span>
            <h2>No assigned care tasks</h2>
            <p>
              Accepted or confirmed bookings will appear here as separate
              visit checklists.
            </p>
          </Card>
        )}

        {!state.loading && !state.error && state.profiles.length > 0 && (
          <>
            <nav className="caregiver-profile-switcher" aria-label="Care recipients">
              <span>Choose care recipient</span>
              <div>
                {state.profiles.map((profile) => (
                  <button
                    className={
                      selectedProfile?.id === profile.id
                        ? "caregiver-profile-option caregiver-profile-option--active"
                        : "caregiver-profile-option"
                    }
                    type="button"
                    aria-pressed={selectedProfile?.id === profile.id}
                    onClick={() => selectProfile(profile.id)}
                    key={profile.id}
                  >
                    <span><UserIcon /></span>
                    {profile.name}
                  </button>
                ))}
              </div>
            </nav>

            <Card className="caregiver-task-page__checklist">
              {selectedProfile && (
                <CaregiverChecklist
                  elderlyProfileId={selectedProfile.id}
                  elderlyName={selectedProfile.name}
                />
              )}
            </Card>
          </>
        )}
      </div>
    </main>
  );
}
