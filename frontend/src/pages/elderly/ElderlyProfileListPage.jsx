import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppHeader } from "../../components/AppHeader.jsx";
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
  // 'new Date()' converts the stored value into a JavaScript Date object.
  const birthDate = new Date(dateOfBirth);

  // 'getTime()' returns milliseconds. 'Number.isNaN()' detects an invalid date.
  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  // 'Date.now()' returns the current millisecond timestamp.
  const elapsedMilliseconds = Date.now() - birthDate.getTime();
  const approximateYears = elapsedMilliseconds / 31557600000;

  // 'Math.floor()' removes the decimal portion to keep completed whole years.
  const age = Math.floor(approximateYears);

  // 'Math.max()' prevents a negative age from being displayed.
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

  if (information.preferredName) {
    return information.preferredName;
  }

  if (information.fullName) {
    return information.fullName;
  }

  return "Care recipient";
}

/**
 * Filters loaded profiles by name, location, or family relationship.
 * @param {object[]} profiles - Profiles returned for the selected status.
 * @param {string} search - Search text entered by the family.
 * @returns {object[]} Matching profiles.
 * @sideEffects None.
 */
function filterProfiles(profiles, search) {
  // 'trim()' removes outside spaces. 'toLowerCase()' makes matching ignore case.
  const query = search.trim().toLowerCase();

  if (!query) {
    return profiles;
  }

  const filteredProfiles = [];

  for (const profile of profiles) {
    const information = profile.personalInformation || {};
    const relationship = profile.familyAccess?.relationship || "";

    const searchableText =
      getProfileName(profile)
      + " "
      + (information.fullName || "")
      + " "
      + (information.district || "")
      + " "
      + relationship;

    // 'toLowerCase()' gives the profile text the same casing as the query.
    const normalizedText = searchableText.toLowerCase();

    // 'includes()' returns true when query occurs anywhere in normalizedText.
    if (normalizedText.includes(query)) {
      // 'push()' appends the matching profile to the result array.
      filteredProfiles.push(profile);
    }
  }

  return filteredProfiles;
}

/**
 * Chooses the correct CSS class for a profile-status tab.
 * @param {string} selectedView - Current active view.
 * @param {string} viewValue - View represented by the button.
 * @returns {string} Active or inactive tab class.
 * @sideEffects None.
 */
function getViewClassName(selectedView, viewValue) {
  if (selectedView === viewValue) {
    return "elderly-profile-view-tab elderly-profile-view-tab--active";
  }

  return "elderly-profile-view-tab";
}

/**
 * Chooses the correct CSS class for a profile card.
 * @param {boolean} isArchived - Whether the profile is archived.
 * @returns {string} Archived or active card class.
 * @sideEffects None.
 */
function getProfileCardClassName(isArchived) {
  if (isArchived) {
    return "elderly-directory-card elderly-directory-card--archived";
  }

  return "elderly-directory-card";
}

/**
 * Displays one record count in the summary row.
 * @param {{icon: import("react").ReactElement, count: number, label: string}} props - Summary content.
 * @returns {import("react").ReactElement} One summary card.
 * @sideEffects None.
 */
function ProfileSummaryCard({ icon, count, label }) {
  return (
    <Card>
      {icon}
      <div>
        <strong>{count}</strong>
        <span>{label}</span>
      </div>
    </Card>
  );
}

/**
 * Displays one linked elderly profile in the directory.
 * @param {{profile: object}} props - Authorized elderly profile.
 * @returns {import("react").ReactElement} Link card for the profile.
 * @sideEffects None.
 */
function ElderlyDirectoryCard({ profile }) {
  const information = profile.personalInformation || {};
  const profileName = getProfileName(profile);
  const age = calculateAge(information.dateOfBirth);
  const isArchived = profile.status === "archived";

  let ageText = "Age not available";

  if (age !== null) {
    ageText = age + " years old";
  }

  return (
    <Link
      className={getProfileCardClassName(isArchived)}
      to={"/elderly-profiles/" + profile._id}
    >
      <span className="profile-avatar profile-avatar--large">
        {profileName[0]}
      </span>

      <div className="elderly-directory-card__identity">
        <div>
          <span className="profile-card__relation">
            {profile.familyAccess?.relationship || "Family member"}
          </span>

          {isArchived && (
            <span className="status-badge">
              Archived
            </span>
          )}
        </div>

        <h2>{profileName}</h2>

        <p>
          {ageText}
          {" · "}
          <MapPinIcon size={14} />
          {information.district || "District not added"}
        </p>
      </div>

      <div className="elderly-directory-card__records">
        <span>
          <HeartPulseIcon size={15} />
          <strong>{profile.chronicDiseases?.length || 0}</strong>
          chronic conditions
        </span>

        <span>
          <PillIcon size={15} />
          <strong>{profile.medications?.length || 0}</strong>
          medications
        </span>

        <span>
          <AlertIcon size={15} />
          <strong>{profile.allergies?.length || 0}</strong>
          allergies
        </span>

        <span>
          <UsersIcon size={15} />
          <strong>{profile.emergencyContacts?.length || 0}</strong>
          emergency contacts
        </span>
      </div>

      <div className="elderly-directory-card__action">
        <span>Open care record</span>
        <ChevronRightIcon size={20} />
      </div>
    </Link>
  );
}

/**
 * Lists and filters elderly profiles linked to the current family.
 * @param {void} _unused - This page accepts no props.
 * @returns {import("react").ReactElement} Status tabs, search, and paginated profiles.
 * @sideEffects Loads authorized profiles whenever the status tab changes.
 */
export function ElderlyProfileListPage() {
  // Each 'useState()' call asks React to remember a value between renders.
  const [state, setState] = useState({
    loading: true,
    profiles: [],
    error: "",
  });
  const [selectedView, setSelectedView] = useState("active");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // 'useEffect()' runs the loading callback after rendering and again whenever
  // selectedView changes. The effect itself stays synchronous.
  useEffect(() => {
    let active = true;

    /**
     * Loads profiles for the selected active, archived, or all view.
     * @param {void} _unused - This function accepts no arguments.
     * @returns {Promise<void>} Resolves after state is updated.
     * @sideEffects Reads the profile API and updates page state.
     */
    async function loadProfiles() {
      // Execution sequence:
      // 1. Preserve old list data while showing the loading state.
      // 2. Request active caller-visible profiles from the service.
      // 3. Ignore stale effect results and store data or error.
      // Passing a function to setState gives us the latest previous state.
      setState(
        /**
         * Keeps existing list state while marking a new request as loading.
         * @param {{loading: boolean, profiles: object[], error: string}} current - Latest list state.
         * @returns {{loading: boolean, profiles: object[], error: string}} Updated loading state.
         * @sideEffects None.
         */
        function markProfilesLoading(current) {
        // The spread copies current fields before loading and error are replaced.
        return {
          ...current,
          loading: true,
          error: "",
          };
        },
      );

      try {
        // 'await' pauses until the service Promise resolves or rejects.
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
          const normalizedError = normalizeApiError(requestError);

          setState({
            loading: false,
            profiles: [],
            error: normalizedError.message,
          });
        }
      }
    }

    // Calling the async function starts it. The effect does not return its Promise.
    loadProfiles();

    /**
     * Prevents a completed request from updating state after unmount.
     * @param {void} _unused - This cleanup accepts no arguments.
     * @returns {void}
     * @sideEffects Changes the local active flag.
     */
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

  // 'Math.ceil()' rounds upward so a partly filled last page still counts.
  const totalPages = Math.ceil(
    filteredProfiles.length / PROFILES_PER_PAGE,
  );

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
    // 'push()' adds each profile belonging to the current page.
    visibleProfiles.push(filteredProfiles[index]);
  }

  let emptyStateTitle = "No profiles in this view";
  let emptyStateDescription =
    "Create a profile to begin coordinating personal and health records.";

  if (search) {
    emptyStateTitle = "No matching profiles";
    emptyStateDescription =
      "Try another name, relationship, or district.";
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

          <Link
            className="button button--primary"
            to="/elderly-profiles/new"
          >
            <PlusIcon size={18} />
            Create profile
          </Link>
        </section>

        <section
          className="elderly-directory-summary"
          aria-label="Profile record summary"
        >
          <ProfileSummaryCard
            icon={<UsersIcon />}
            count={state.profiles.length}
            label="Profiles in this view"
          />
          <ProfileSummaryCard
            icon={<PillIcon />}
            count={medicationCount}
            label="Medication records"
          />
          <ProfileSummaryCard
            icon={<AlertIcon />}
            count={allergyCount}
            label="Known allergies"
          />
        </section>

        <div className="elderly-directory-toolbar">
          <nav
            className="elderly-profile-view-tabs"
            aria-label="Filter elderly profiles"
          >
            {/* 'map()' converts each view object into one React button. */}
            {PROFILE_VIEWS.map((view) => (
              <button
                type="button"
                className={getViewClassName(selectedView, view.value)}
                aria-pressed={selectedView === view.value}
                key={view.value}
                onClick={() => {
                  changeView(view.value);
                }}
              >
                {view.value === "archived" && (
                  <ArchiveIcon size={15} />
                )}
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

        {state.error && (
          <div className="alert alert--error">
            {state.error}
          </div>
        )}

        {!state.loading && filteredProfiles.length === 0 && (
          <Card className="empty-state elderly-directory-empty">
            <span className="feature-icon">
              <UserPlusIcon />
            </span>

            <h2>{emptyStateTitle}</h2>
            <p>{emptyStateDescription}</p>

            {selectedView === "active" && !search && (
              <Link
                className="button button--primary"
                to="/elderly-profiles/new"
              >
                <PlusIcon size={18} />
                Create profile
              </Link>
            )}
          </Card>
        )}

        <div className="elderly-profile-card-list">
          {/* 'map()' converts each visible profile into one directory card. */}
          {visibleProfiles.map((profile) => (
            <ElderlyDirectoryCard
              key={profile._id}
              profile={profile}
            />
          ))}
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