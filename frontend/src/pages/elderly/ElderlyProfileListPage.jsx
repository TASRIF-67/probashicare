import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader.jsx";
import { Button } from "../../components/Button.jsx";
import { Card } from "../../components/Card.jsx";
import { Pagination } from "../../components/Pagination.jsx";
import { normalizeApiError } from "../../services/api.js";
import { elderlyProfileService } from "../../services/elderlyProfileService.js";
import {
  AlertIcon,
  ArchiveIcon,
  ChevronRightIcon,
  HeartPulseIcon,
  MapPinIcon,
  PillIcon,
  PlusIcon,
  SearchIcon,
  UserPlusIcon,
  UsersIcon,
} from "../../components/Icons.jsx";

const PROFILES_PER_PAGE = 3;
const PROFILE_VIEWS = [
  {
    value: "active",
    label: "Active profiles",
  },
  {
    value: "archived",
    label: "Archived",
  },
  {
    value: "all",
    label: "All profiles",
  },
];

/**
 * Calculates an approximate current age from a birth date.
 * @param {string|Date} dateOfBirth - Stored date of birth.
 * @returns {number|null} Completed years or null for an invalid date.
 * @sideEffects Reads the current date.
 */
function calculateAge(dateOfBirth) {
  const birthDate = new Date(dateOfBirth);

  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const age = Math.floor((Date.now() - birthDate.getTime()) / 31557600000);
  return Math.max(0, age);
}

/**
 * Returns a safe readable name for an elderly profile.
 * @param {object} profile - Authorized profile response.
 * @returns {string} Preferred name, full name, or fallback label.
 * @sideEffects None.
 */
function getProfileName(profile) {
  const information = profile.personalInformation || {};
  return information.preferredName
    || information.fullName
    || "Care recipient";
}

/**
 * Filters loaded profiles by name, location, or family relationship.
 * @param {object[]} profiles - Profiles returned for the selected status.
 * @param {string} search - Search text entered by the family.
 * @returns {object[]} Matching profiles.
 * @sideEffects None.
 */
function filterProfiles(profiles, search) {
  const query = search.trim().toLowerCase();

  if (!query) {
    return profiles;
  }

  const filteredProfiles = [];

  for (const profile of profiles) {
    const information = profile.personalInformation || {};
    const searchableText = (
      getProfileName(profile)
      + " "
      + (information.fullName || "")
      + " "
      + (information.district || "")
      + " "
      + (profile.familyAccess?.relationship || "")
    ).toLowerCase();

    if (searchableText.includes(query)) {
      filteredProfiles.push(profile);
    }
  }

  return filteredProfiles;
}

/**
 * Lists and filters elderly profiles linked to the current family.
 * @returns {import("react").ReactElement} Status tabs, search, and paginated profiles.
 * @sideEffects Loads authorized profiles whenever the status tab changes.
 */
export function ElderlyProfileListPage() {
  const [state, setState] = useState({
    loading: true,
    profiles: [],
    error: "",
  });
  const [selectedView, setSelectedView] = useState("active");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let active = true;

    /**
     * Loads profiles for the selected active, archived, or all view.
     * @returns {Promise<void>}
     * @sideEffects Reads the profile API and updates page state.
     */
    async function loadProfiles() {
      setState(function markProfilesLoading(current) {
        return {
          ...current,
          loading: true,
          error: "",
        };
      });

      try {
        const data = await elderlyProfileService.listProfiles(selectedView);

        if (active) {
          setState({
            loading: false,
            profiles: data.profiles || [],
            error: "",
          });
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

    loadProfiles();

    return function stopProfileLoad() {
      active = false;
    };
  }, [selectedView]);

  /**
   * Opens a different profile status view and resets list controls.
   * @param {string} view - Active, archived, or all status value.
   * @returns {void}
   * @sideEffects Updates view, search, and pagination state.
   */
  function changeView(view) {
    setSelectedView(view);
    setSearch("");
    setPage(1);
  }

  /**
   * Updates profile search text and returns to the first page.
   * @param {import("react").ChangeEvent<HTMLInputElement>} event - Search input event.
   * @returns {void}
   * @sideEffects Updates search and pagination state.
   */
  function changeSearch(event) {
    setSearch(event.target.value);
    setPage(1);
  }

  const filteredProfiles = filterProfiles(state.profiles, search);
  const totalPages = Math.ceil(filteredProfiles.length / PROFILES_PER_PAGE);
  const firstProfileIndex = (page - 1) * PROFILES_PER_PAGE;
  const visibleProfiles = [];
  let medicationCount = 0;
  let allergyCount = 0;

  for (const profile of state.profiles) {
    medicationCount += profile.medications?.length || 0;
    allergyCount += profile.allergies?.length || 0;
  }

  for (
    let index = firstProfileIndex;
    index < firstProfileIndex + PROFILES_PER_PAGE
      && index < filteredProfiles.length;
    index += 1
  ) {
    visibleProfiles.push(filteredProfiles[index]);
  }

  return (
    <main>
      <AppHeader />
      <div className="feature-page elderly-profile-directory">
        <section className="elderly-directory-hero">
          <div>
            <span className="eyebrow">Family care records</span>
            <h1>Elderly profiles</h1>
            <p>
              Keep personal information, health context, medication records,
              and emergency contacts organized for each care recipient.
            </p>
          </div>
          <Link className="button button--primary" to="/elderly-profiles/new">
            <PlusIcon size={18} />
            Create profile
          </Link>
        </section>

        <section className="elderly-directory-summary" aria-label="Profile record summary">
          <Card><UsersIcon /><div><strong>{state.profiles.length}</strong><span>Profiles in this view</span></div></Card>
          <Card><PillIcon /><div><strong>{medicationCount}</strong><span>Medication records</span></div></Card>
          <Card><AlertIcon /><div><strong>{allergyCount}</strong><span>Known allergies</span></div></Card>
        </section>

        <div className="elderly-directory-toolbar">
          <nav className="elderly-profile-view-tabs" aria-label="Filter elderly profiles">
            {PROFILE_VIEWS.map((view) => (
              <button
                type="button"
                className={selectedView === view.value
                  ? "elderly-profile-view-tab elderly-profile-view-tab--active"
                  : "elderly-profile-view-tab"}
                aria-pressed={selectedView === view.value}
                key={view.value}
                onClick={() => changeView(view.value)}
              >
                {view.value === "archived" && <ArchiveIcon size={15} />}
                {view.label}
              </button>
            ))}
          </nav>
          <label className="elderly-directory-search">
            <SearchIcon size={17} />
            <span className="sr-only">Search elderly profiles</span>
            <input
              type="search"
              value={search}
              placeholder="Search name, relationship, or district"
              onChange={changeSearch}
            />
          </label>
        </div>

        {state.loading && (
          <div className="page-loader-inline">
            <span className="spinner" />
            Loading profiles
          </div>
        )}
        {state.error && <div className="alert alert--error">{state.error}</div>}

        {!state.loading && filteredProfiles.length === 0 && (
          <Card className="empty-state elderly-directory-empty">
            <span className="feature-icon"><UserPlusIcon /></span>
            <h2>{search ? "No matching profiles" : "No profiles in this view"}</h2>
            <p>
              {search
                ? "Try another name, relationship, or district."
                : "Create a profile to begin coordinating personal and health records."}
            </p>
            {selectedView === "active" && !search && (
              <Link className="button button--primary" to="/elderly-profiles/new">
                <PlusIcon size={18} />
                Create profile
              </Link>
            )}
          </Card>
        )}

        <div className="elderly-profile-card-list">
          {visibleProfiles.map((profile) => {
            const information = profile.personalInformation || {};
            const profileName = getProfileName(profile);
            const age = calculateAge(information.dateOfBirth);
            const isArchived = profile.status === "archived";

            return (
              <Link
                className={isArchived
                  ? "elderly-directory-card elderly-directory-card--archived"
                  : "elderly-directory-card"}
                to={"/elderly-profiles/" + profile._id}
                key={profile._id}
              >
                <span className="profile-avatar profile-avatar--large">
                  {profileName[0]}
                </span>
                <div className="elderly-directory-card__identity">
                  <div>
                    <span className="profile-card__relation">
                      {profile.familyAccess?.relationship || "Family member"}
                    </span>
                    {isArchived && <span className="status-badge">Archived</span>}
                  </div>
                  <h2>{profileName}</h2>
                  <p>
                    {age === null ? "Age not available" : age + " years old"}
                    {" · "}
                    <MapPinIcon size={14} />
                    {information.district || "District not added"}
                  </p>
                </div>
                <div className="elderly-directory-card__records">
                  <span><HeartPulseIcon size={15} /><strong>{profile.chronicDiseases?.length || 0}</strong> chronic conditions</span>
                  <span><PillIcon size={15} /><strong>{profile.medications?.length || 0}</strong> medications</span>
                  <span><AlertIcon size={15} /><strong>{profile.allergies?.length || 0}</strong> allergies</span>
                  <span><UsersIcon size={15} /><strong>{profile.emergencyContacts?.length || 0}</strong> emergency contacts</span>
                </div>
                <div className="elderly-directory-card__action">
                  <span>Open care record</span>
                  <ChevronRightIcon size={20} />
                </div>
              </Link>
            );
          })}
        </div>

        <Pagination
          page={page}
          pages={totalPages}
          total={filteredProfiles.length}
          label="profiles"
          disabled={state.loading}
          onPageChange={setPage}
        />
      </div>
    </main>
  );
}
