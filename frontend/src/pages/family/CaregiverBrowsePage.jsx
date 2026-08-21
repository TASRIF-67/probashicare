import { useEffect, useState } from "react";
import { AppHeader } from "../../components/AppHeader.jsx";
import { Button } from "../../components/Button.jsx";
import { Card } from "../../components/Card.jsx";
import {
  AlertIcon,
  CalendarIcon,
  ClockIcon,
  MapPinIcon,
  SearchIcon,
  ShieldCheckIcon,
  StarIcon,
} from "../../components/Icons.jsx";
import { Pagination } from "../../components/Pagination.jsx";
import { api, normalizeApiError } from "../../services/api.js";
import { CaregiverBookingModal } from "../../components/booking/CaregiverBookingModal.jsx";
import { PremiumFeatureGate } from "../../components/subscription/PremiumFeatureGate.jsx";
import { subscriptionService } from "../../services/subscriptionService.js";

const CAREGIVERS_PER_PAGE = 3;
const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
const SERVICE_TYPES = [
  "companionship",
  "personal-care",
  "medical-support",
  "post-surgery",
  "overnight",
  "rehabilitation",
];

/**
 * Converts a stored hyphenated label into readable title text.
 * @param {string} value - Stored service or weekday value.
 * @returns {string} Capitalized readable label.
 * @sideEffects None.
 */
function humanize(value) {
  const words = String(value || "").replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Combines a caregiver availability range for display.
 * @param {string} startTime - Availability start time.
 * @param {string} endTime - Availability end time.
 * @returns {string} Readable start and end range.
 * @sideEffects None.
 */
function toDisplayTime(startTime, endTime) {
  return startTime + " - " + endTime;
}

/**
 * Displays one verified caregiver using only marketplace-safe profile data.
 * @param {{caregiver: object, onBook: (caregiver: object) => void}} props - Public caregiver profile and booking handler.
 * @returns {import("react").ReactElement} Professional caregiver directory card.
 * @sideEffects Toggles weekly schedule visibility and may open booking flow.
 */
function CaregiverCard({ caregiver, onBook }) {
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const availability = caregiver.availability || [];
  const services = caregiver.supportedServiceTypes || [];
  const visibleServices = services.slice(0, 3);
  const additionalServiceCount = services.length - visibleServices.length;
  const previewAvailability = availability.slice(0, 2);

  /**
   * Opens or closes the complete weekly schedule.
   * @returns {void}
   * @sideEffects Updates local schedule visibility.
   */
  function toggleSchedule() {
    setIsScheduleOpen((current) => !current);
  }

  /**
   * Starts the booking flow for this caregiver.
   * @returns {void}
   * @sideEffects Calls the parent booking handler.
   */
  function startBooking() {
    onBook(caregiver);
  }

  const displayedAvailability = isScheduleOpen
    ? availability
    : previewAvailability;

  return (
    <Card className="family-caregiver-card">
      <div className="family-caregiver-card__header">
        <div className="family-caregiver-card__identity">
          <span className="profile-avatar">
            {caregiver.name?.[0] || "C"}
          </span>
          <div>
            <span className="verified-caregiver-label">
              <ShieldCheckIcon size={14} />
              Verified professional
            </span>
            <h2>{caregiver.name}</h2>
            <span className="family-caregiver-card__rating">
              <StarIcon size={14} />
              {caregiver.reviewCount
                ? caregiver.averageRating.toFixed(1)
                : "New"}
              <small>
                {caregiver.reviewCount} verified review
                {caregiver.reviewCount === 1 ? "" : "s"}
              </small>
            </span>
            <span className="family-caregiver-card__location">
              <MapPinIcon size={14} />
              {caregiver.serviceArea || "Local service area"}
            </span>
          </div>
        </div>
        <div className="family-caregiver-card__rate">
          <span>Hourly rate</span>
          <strong>
            {caregiver.hourlyRate
              ? "BDT " + caregiver.hourlyRate + "/hr"
              : "On request"}
          </strong>
        </div>
      </div>

      {caregiver.bio && (
        <p className="family-caregiver-card__bio">{caregiver.bio}</p>
      )}

      <div className="family-caregiver-card__facts">
        <span>
          <ShieldCheckIcon size={16} />
          <strong>{caregiver.yearsOfExperience ?? 0} years</strong>
          experience
        </span>
        <span>
          <CalendarIcon size={16} />
          <strong>{availability.length} weekly</strong>
          time slot{availability.length === 1 ? "" : "s"}
        </span>
      </div>

      <section className="family-caregiver-card__services" aria-label="Supported services">
        <strong>Care services</strong>
        <div>
          {visibleServices.map((service) => (
            <span key={service}>{humanize(service)}</span>
          ))}
          {additionalServiceCount > 0 && (
            <span>+{additionalServiceCount} more</span>
          )}
        </div>
      </section>

      <section className="family-caregiver-card__availability" aria-label="Weekly availability">
        <div className="family-caregiver-card__section-heading">
          <strong>Weekly availability</strong>
          {availability.length > 2 && (
            <button type="button" onClick={toggleSchedule}>
              {isScheduleOpen ? "Show less" : "View full schedule"}
            </button>
          )}
        </div>
        {displayedAvailability.length ? (
          <div className="family-caregiver-availability-list">
            {displayedAvailability.map((slot, index) => (
              <div key={slot.day + "-" + slot.startTime + "-" + index}>
                <span>{humanize(slot.day)}</span>
                <strong>
                  <ClockIcon size={14} />
                  {toDisplayTime(slot.startTime, slot.endTime)}
                </strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="family-caregiver-card__unavailable">
            Weekly availability has not been added yet.
          </p>
        )}
      </section>

      <div className="family-caregiver-card__footer">
        <span>Review available dates before confirming your request.</span>
        <Button type="button" disabled={!availability.length} onClick={startBooking}>
          <CalendarIcon size={17} />
          Check dates and book
        </Button>
      </div>
    </Card>
  );
}

/**
 * Displays the protected caregiver marketplace for family accounts.
 * @returns {import("react").ReactElement} Searchable, paginated caregiver directory.
 * @sideEffects Loads caregivers and subscription access, and may open booking dialogs.
 */
export function CaregiverBrowsePage() {
  const [caregivers, setCaregivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
    serviceType: "",
    day: "",
    search: "",
  });
  const [appliedFilters, setAppliedFilters] = useState({
    serviceType: "",
    day: "",
    search: "",
  });
  const [page, setPage] = useState(1);
  const [selectedCaregiver, setSelectedCaregiver] = useState(null);
  const [hasPremium, setHasPremium] = useState(false);
  const [showPremiumGate, setShowPremiumGate] = useState(false);

  useEffect(() => {
    let active = true;

    /**
     * Loads the initial caregiver directory and current subscription access.
     * @returns {Promise<void>}
     * @sideEffects Calls protected APIs and updates marketplace state.
     */
    async function loadMarketplace() {
      try {
        const caregiverResponse = await api.get("/caregivers");

        if (active) {
          setCaregivers(caregiverResponse.data.data.caregivers || []);
          setError("");
          setLoading(false);
        }
      } catch (requestError) {
        if (active) {
          setError(normalizeApiError(requestError).message);
          setLoading(false);
        }
      }

      try {
        const subscription = await subscriptionService.getMySubscription();

        if (active) {
          setHasPremium(Boolean(subscription.access?.isPremium));
        }
      } catch {
        if (active) {
          setHasPremium(false);
        }
      }
    }

    loadMarketplace();

    return function stopMarketplaceLoad() {
      active = false;
    };
  }, []);

  /**
   * Loads caregivers for the supplied service, day, and text filters.
   * @param {{serviceType: string, day: string, search: string}} nextFilters - Filters to apply.
   * @returns {Promise<void>}
   * @sideEffects Calls the caregiver API and updates directory state.
   */
  async function loadCaregivers(nextFilters) {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/caregivers", {
        params: {
          serviceType: nextFilters.serviceType || undefined,
          day: nextFilters.day || undefined,
        },
      });
      const list = response.data.data.caregivers || [];
      const query = nextFilters.search.trim().toLowerCase();
      const visibleCaregivers = [];

      for (const caregiver of list) {
        const searchableText = (
          caregiver.name
          + " "
          + (caregiver.bio || "")
          + " "
          + (caregiver.serviceArea || "")
        ).toLowerCase();

        if (!query || searchableText.includes(query)) {
          visibleCaregivers.push(caregiver);
        }
      }

      setCaregivers(visibleCaregivers);
      setAppliedFilters(nextFilters);
      setPage(1);
    } catch (requestError) {
      setError(normalizeApiError(requestError).message);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Applies the currently entered caregiver filters.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Filter form submission.
   * @returns {Promise<void>}
   * @sideEffects Prevents navigation and reloads caregiver results.
   */
  async function applyFilters(event) {
    event.preventDefault();
    await loadCaregivers(filters);
  }

  /**
   * Clears every caregiver filter and restores the full directory.
   * @returns {Promise<void>}
   * @sideEffects Resets filter state and reloads caregivers.
   */
  async function clearFilters() {
    const emptyFilters = {
      serviceType: "",
      day: "",
      search: "",
    };
    setFilters(emptyFilters);
    await loadCaregivers(emptyFilters);
  }

  /**
   * Opens booking for Premium families or shows the access explanation.
   * @param {object} caregiver - Selected marketplace caregiver.
   * @returns {void}
   * @sideEffects Opens the booking modal or Premium feature gate.
   */
  function openBookingModal(caregiver) {
    if (!hasPremium) {
      setShowPremiumGate(true);
      return;
    }

    setSelectedCaregiver(caregiver);
  }

  const hasAppliedFilters = Boolean(
    appliedFilters.serviceType
    || appliedFilters.day
    || appliedFilters.search,
  );
  const totalPages = Math.ceil(caregivers.length / CAREGIVERS_PER_PAGE);
  const firstCaregiverIndex = (page - 1) * CAREGIVERS_PER_PAGE;
  const visibleCaregivers = [];

  for (
    let index = firstCaregiverIndex;
    index < firstCaregiverIndex + CAREGIVERS_PER_PAGE
      && index < caregivers.length;
    index += 1
  ) {
    visibleCaregivers.push(caregivers[index]);
  }

  return (
    <main>
      <AppHeader />
      <div className="feature-page family-caregiver-marketplace">
        <section className="family-caregiver-hero">
          <div>
            <span className="eyebrow">Verified care network</span>
            <h1>Find the right caregiver</h1>
            <p>
              Compare professional experience, care services, and real weekly
              availability before requesting a schedule.
            </p>
          </div>
          <div className="family-caregiver-hero__trust">
            <ShieldCheckIcon />
            <div>
              <strong>Admin verified</strong>
              <span>Approved caregiver profiles only</span>
            </div>
          </div>
        </section>

        <Card className="family-caregiver-filters">
          <form onSubmit={applyFilters}>
            <label className="field family-caregiver-search">
              <span>Search professionals</span>
              <span className="family-caregiver-search__input">
                <SearchIcon size={17} />
                <input
                  value={filters.search}
                  placeholder="Name, experience, or location"
                  onChange={(event) => setFilters((current) => ({
                    ...current,
                    search: event.target.value,
                  }))}
                />
              </span>
            </label>
            <label className="field">
              <span>Care service</span>
              <select
                className="input"
                value={filters.serviceType}
                onChange={(event) => setFilters((current) => ({
                  ...current,
                  serviceType: event.target.value,
                }))}
              >
                <option value="">All services</option>
                {SERVICE_TYPES.map((type) => (
                  <option key={type} value={type}>{humanize(type)}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Available day</span>
              <select
                className="input"
                value={filters.day}
                onChange={(event) => setFilters((current) => ({
                  ...current,
                  day: event.target.value,
                }))}
              >
                <option value="">Any day</option>
                {DAYS.map((day) => (
                  <option key={day} value={day}>{humanize(day)}</option>
                ))}
              </select>
            </label>
            <div className="family-caregiver-filter-actions">
              {hasAppliedFilters && (
                <Button type="button" variant="secondary" onClick={clearFilters}>
                  Clear
                </Button>
              )}
              <Button type="submit" isLoading={loading}>
                <SearchIcon size={17} />
                Find caregivers
              </Button>
            </div>
          </form>
        </Card>

        <div className="family-caregiver-results-heading">
          <div>
            <h2>Available professionals</h2>
            <p>
              {caregivers.length} verified caregiver
              {caregivers.length === 1 ? "" : "s"} found
            </p>
          </div>
          {hasAppliedFilters && <span>Filtered results</span>}
        </div>

        {loading && (
          <div className="page-loader-inline">
            <span className="spinner" />
            Loading caregivers
          </div>
        )}
        {error && <div className="alert alert--error">{error}</div>}

        {!loading && !caregivers.length && (
          <Card className="empty-state family-caregiver-empty">
            <span className="feature-icon"><AlertIcon /></span>
            <h2>No caregivers match these filters</h2>
            <p>Try a different service, day, name, or location.</p>
            {hasAppliedFilters && (
              <Button type="button" variant="secondary" onClick={clearFilters}>
                Clear all filters
              </Button>
            )}
          </Card>
        )}

        <div className="family-caregiver-list">
          {visibleCaregivers.map((caregiver) => (
            <CaregiverCard
              key={caregiver._id}
              caregiver={caregiver}
              onBook={openBookingModal}
            />
          ))}
        </div>

        <Pagination
          page={page}
          pages={totalPages}
          total={caregivers.length}
          label="caregivers"
          disabled={loading}
          onPageChange={setPage}
        />
      </div>

      <CaregiverBookingModal
        caregiver={selectedCaregiver}
        onClose={() => setSelectedCaregiver(null)}
      />
      <PremiumFeatureGate
        isOpen={showPremiumGate}
        featureName="Creating a new caregiver booking"
        onClose={() => setShowPremiumGate(false)}
      />
    </main>
  );
}
