import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "../AppHeader.jsx";
import { Card } from "../Card.jsx";
import {
  ArrowRightIcon,
  MapPinIcon,
  PillIcon,
  PlusIcon,
  StethoscopeIcon,
} from "../Icons.jsx";
import { normalizeApiError } from "../../services/api.js";
import { elderlyProfileService } from "../../services/elderlyProfileService.js";

/**
 * Returns a safe display name for an elderly profile.
 * @param {object} profile - Authorized elderly profile.
 * @returns {string} Preferred name, full name, or fallback.
 * @sideEffects None.
 */
function getProfileName(profile) {
  const personal = profile.personalInformation || {};
  return personal.preferredName || personal.fullName || "Care recipient";
}

/**
 * Reserves the profile-card layout while active profiles are loading.
 * @returns {import("react").ReactElement} Accessible three-card skeleton.
 * @sideEffects None.
 */
function ProfileFeatureHubSkeleton() {
  const placeholderKeys = ["profile-one", "profile-two", "profile-three"];

  return (
    <section
      className="profile-feature-skeleton"
      aria-label="Loading care profiles"
      aria-live="polite"
    >
      <span className="sr-only">Loading care profiles</span>
      <div className="profile-feature-grid" aria-hidden="true">
        {placeholderKeys.map((placeholderKey) => (
          <article className="profile-feature-skeleton__card" key={placeholderKey}>
            <div className="profile-feature-skeleton__identity">
              <span className="skeleton-shape skeleton-shape--avatar" />
              <div>
                <span className="skeleton-shape skeleton-shape--eyebrow" />
                <span className="skeleton-shape skeleton-shape--title" />
                <span className="skeleton-shape skeleton-shape--text" />
              </div>
            </div>
            <div className="profile-feature-skeleton__facts">
              <span className="skeleton-shape" />
              <span className="skeleton-shape" />
            </div>
            <span className="skeleton-shape skeleton-shape--button" />
          </article>
        ))}
      </div>
    </section>
  );
}

/**
 * Displays a feature entry page where a family selects the relevant care recipient.
 * @param {object} props - Feature presentation and route builder.
 * @param {string} props.eyebrow - Small heading label.
 * @param {string} props.title - Main page heading.
 * @param {string} props.description - Page explanation.
 * @param {import("react").ComponentType} props.icon - Feature icon component.
 * @param {string} props.actionLabel - Profile action label.
 * @param {string} props.emptyDescription - Empty-state explanation.
 * @param {(profileId: string) => string} props.buildDestination - Route builder.
 * @returns {import("react").ReactElement} Family profile-selection hub.
 * @sideEffects Loads active family-authorized elderly profiles.
 */
export function ProfileFeatureHub({
  eyebrow,
  title,
  description,
  icon: FeatureIcon,
  actionLabel,
  emptyDescription,
  buildDestination,
}) {
  const [state, setState] = useState({
    loading: true,
    profiles: [],
    error: "",
  });

  useEffect(() => {
    let active = true;

    /**
     * Loads active elderly profiles linked to the current family.
     * @returns {Promise<void>} Resolves after the hub state is updated.
     * @sideEffects Calls the elderly-profile API and updates React state.
     */
    async function loadProfiles() {
      try {
        const data = await elderlyProfileService.listProfiles("active");

        if (active) {
          setState({
            loading: false,
            profiles: data.profiles || [],
            error: "",
          });
        }
      } catch (error) {
        if (active) {
          setState({
            loading: false,
            profiles: [],
            error: normalizeApiError(error).message,
          });
        }
      }
    }

    loadProfiles();

    return function stopProfileLoad() {
      active = false;
    };
  }, []);

  return (
    <main>
      <AppHeader />
      <div className="feature-page profile-feature-hub">
        <header className="profile-feature-hub__hero">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <span className="profile-feature-hub__icon" aria-hidden="true">
            <FeatureIcon />
          </span>
        </header>

        {state.loading && <ProfileFeatureHubSkeleton />}

        {state.error && <div className="alert alert--error">{state.error}</div>}

        {!state.loading && !state.error && state.profiles.length === 0 && (
          <Card className="profile-feature-hub__empty">
            <span><FeatureIcon /></span>
            <h2>No active elderly profiles</h2>
            <p>{emptyDescription}</p>
            <Link className="button button--primary" to="/elderly-profiles/new">
              <PlusIcon size={17} />
              Create elderly profile
            </Link>
          </Card>
        )}

        {!state.loading && !state.error && state.profiles.length > 0 && (
          <section aria-labelledby="profile-feature-selection-title">
            <div className="profile-feature-hub__heading">
              <div>
                <span className="eyebrow">Care recipients</span>
                <h2 id="profile-feature-selection-title">
                  Choose whose information to open
                </h2>
              </div>
              <span>{state.profiles.length} active profile{state.profiles.length === 1 ? "" : "s"}</span>
            </div>

            <div className="profile-feature-grid">
              {state.profiles.map((profile) => {
                const personal = profile.personalInformation || {};
                const profileName = getProfileName(profile);
                const profileId = profile._id || profile.id;

                return (
                  <article className="profile-feature-card" key={profileId}>
                    <div className="profile-feature-card__identity">
                      <span className="profile-avatar">{profileName.charAt(0)}</span>
                      <div>
                        <span className="eyebrow">
                          {profile.familyAccess?.relationship || "Family care"}
                        </span>
                        <h3>{profileName}</h3>
                        <p>
                          <MapPinIcon size={14} />
                          {personal.district || "Location not recorded"}
                        </p>
                      </div>
                    </div>

                    <div className="profile-feature-card__facts">
                      <span>
                        <PillIcon size={16} />
                        <strong>{profile.medications?.length || 0}</strong>
                        Medications
                      </span>
                      <span>
                        <StethoscopeIcon size={16} />
                        <strong>{profile.chronicDiseases?.length || 0}</strong>
                        Conditions
                      </span>
                    </div>

                    <Link
                      className="button button--primary"
                      to={buildDestination(profileId)}
                    >
                      {actionLabel}
                      <ArrowRightIcon size={17} />
                    </Link>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
