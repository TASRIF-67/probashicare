import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import CountUp from "react-countup";
import { AppHeader } from "../components/AppHeader.jsx";
import { Card } from "../components/Card.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  CalendarIcon,
  ClockIcon,
  HeartPulseIcon,
  ShieldCheckIcon,
  StarIcon,
  UsersIcon,
} from "../components/Icons.jsx";
import { bookingService } from "../services/bookingService.js";
import { elderlyProfileService } from "../services/elderlyProfileService.js";
import { normalizeApiError } from "../services/api.js";
import { subscriptionService } from "../services/subscriptionService.js";
import { SubscriptionStatusCard } from "../components/subscription/SubscriptionStatusCard.jsx";
import { SubscriptionExpiryModal } from "../components/subscription/SubscriptionExpiryModal.jsx";
import { CaregiverFeedbackModal } from "../components/booking/CaregiverFeedbackModal.jsx";
import { createRevealMotion } from "../utils/motion.js";

const ACTIVE_STATUSES = ["pending", "accepted", "confirmed"];
const ASSIGNED_STATUSES = ["accepted", "confirmed"];

/**
 * Formats a stored date without shifting its UTC calendar day.
 * @param {string|Date} value - Stored booking or occurrence date.
 * @returns {string} Localized date label.
 * @sideEffects None.
 */
function displayDate(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  });
}

/**
 * Counts family bookings in a supplied group of statuses.
 * @param {object[]} bookings - All family booking records.
 * @param {string[]} statuses - Statuses included in the count.
 * @returns {number} Number of matching bookings.
 * @sideEffects None.
 */
function countBookings(bookings, statuses) {
  let count = 0;

  for (const booking of bookings) {
    if (statuses.includes(booking.status)) {
      count += 1;
    }
  }

  return count;
}

/**
 * Collects active family booking records for compact dashboard display.
 * @param {object[]} bookings - All family booking records.
 * @returns {object[]} Pending, accepted, and confirmed bookings.
 * @sideEffects None.
 */
function getActiveBookings(bookings) {
  const activeBookings = [];

  for (const booking of bookings) {
    if (ACTIVE_STATUSES.includes(booking.status)) {
      activeBookings.push(booking);
    }
  }

  return activeBookings;
}

/**
 * Finds the earliest upcoming visit in an accepted family booking.
 * @param {object[]} bookings - All family booking records.
 * @returns {{booking: object, occurrence: object}|null} Next care visit or null.
 * @sideEffects Reads the current local calendar date.
 */
function findNextCareVisit(bookings) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let nextVisit = null;

  for (const booking of bookings) {
    if (!ASSIGNED_STATUSES.includes(booking.status)) {
      continue;
    }

    for (const occurrence of booking.occurrences || []) {
      const occurrenceDate = new Date(occurrence.date);

      if (Number.isNaN(occurrenceDate.getTime())) {
        continue;
      }

      if (occurrenceDate < today) {
        continue;
      }

      if (!nextVisit || occurrenceDate < new Date(nextVisit.occurrence.date)) {
        nextVisit = {
          booking,
          occurrence,
        };
      }
    }
  }

  return nextVisit;
}

/**
 * Returns the readable name stored on an elderly profile.
 * @param {object} profile - Authorized elderly profile.
 * @returns {string} Preferred or full name.
 * @sideEffects None.
 */
function getProfileName(profile) {
  const information = profile?.personalInformation;

  if (!information) {
    return "Care recipient";
  }

  return information.preferredName
    || information.fullName
    || "Care recipient";
}

/**
 * Chooses a friendly greeting from the current local hour.
 * @param {Date} date - Current local date and time.
 * @returns {string} Morning, afternoon, or evening greeting.
 * @sideEffects None.
 */
function getTimeOfDayGreeting(date) {
  const hour = date.getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

/**
 * Formats today's local date for the dashboard context chip.
 * @param {Date} date - Current local date.
 * @returns {string} Weekday and medium calendar date.
 * @sideEffects None.
 */
function formatToday(date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(date);
}

/**
 * Displays a short count-up for numeric metrics while respecting reduced motion.
 * @param {{value: number|string, reduceMotion: boolean|null}} props - Metric value and motion preference.
 * @returns {import("react").ReactElement} Animated number or unchanged text.
 * @sideEffects Runs a brief visual count animation for numeric values.
 */
function DashboardMetricValue({ value, reduceMotion }) {
  if (typeof value !== "number" || reduceMotion) {
    return <strong>{value}</strong>;
  }

  return (
    <strong>
      <CountUp
        end={value}
        duration={0.75}
        separator=","
        preserveValue
      />
    </strong>
  );
}

/**
 * Renders the family care-coordination dashboard.
 * @returns {import("react").ReactElement} Profiles, bookings, subscription, and care actions.
 * @sideEffects Loads family profiles, bookings, and subscription access.
 */
export function DashboardPage() {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const currentDate = new Date();
  const greeting = getTimeOfDayGreeting(currentDate);
  const [careState, setCareState] = useState({
    loading: true,
    bookings: [],
    profiles: [],
    error: "",
  });
  const [subscriptionState, setSubscriptionState] = useState({
    loading: true,
    data: null,
  });
  const [isDismissingReminder, setIsDismissingReminder] = useState(false);
  const [feedbackBooking, setFeedbackBooking] = useState(null);

  useEffect(() => {
    let active = true;

    /**
     * Loads family profiles and booking activity for the dashboard.
     * @returns {Promise<void>}
     * @sideEffects Calls protected care APIs and updates dashboard state.
     */
    async function loadCareOverview() {
      let bookings = [];
      let profiles = [];
      const errorMessages = [];

      try {
        const bookingResult = await bookingService.listMyBookings();
        bookings = bookingResult.bookings || [];

        if (active) {
          for (const booking of bookings) {
            if (booking.status !== "completed" || booking.review) {
              continue;
            }

            const promptKey = "caregiver-feedback-prompt-" + booking._id;

            if (!window.sessionStorage.getItem(promptKey)) {
              setFeedbackBooking(booking);
              break;
            }
          }
        }
      } catch (requestError) {
        errorMessages.push(
          "Bookings: " + normalizeApiError(requestError).message,
        );
      }

      try {
        const profileResult = await elderlyProfileService.listProfiles();
        profiles = profileResult.profiles || [];
      } catch (requestError) {
        errorMessages.push(
          "Care profiles: " + normalizeApiError(requestError).message,
        );
      }

      if (active) {
        setCareState({
          loading: false,
          bookings,
          profiles,
          error: errorMessages.join(" "),
        });
      }
    }

    loadCareOverview();

    return function stopCareOverviewLoad() {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    /**
     * Loads the family's subscription status and expiry reminder.
     * @returns {Promise<void>}
     * @sideEffects Calls the subscription API and updates dashboard state.
     */
    async function loadSubscription() {
      try {
        const data = await subscriptionService.getMySubscription();

        if (active) {
          setSubscriptionState({
            loading: false,
            data,
          });
        }
      } catch {
        if (active) {
          setSubscriptionState({
            loading: false,
            data: null,
          });
        }
      }
    }

    loadSubscription();

    return function stopSubscriptionLoad() {
      active = false;
    };
  }, []);

  /**
   * Persists a one-day reminder dismissal from the dashboard modal.
   * @returns {Promise<void>}
   * @sideEffects Calls the notification API and updates subscription state.
   */
  async function dismissSubscriptionReminder() {
    const reminderId = subscriptionState.data?.reminder?._id;

    if (!reminderId) {
      return;
    }

    setIsDismissingReminder(true);

    try {
      await subscriptionService.dismissReminder(reminderId, 24);
      setSubscriptionState(function removeReminder(current) {
        return {
          ...current,
          data: {
            ...current.data,
            reminder: null,
          },
        };
      });
    } finally {
      setIsDismissingReminder(false);
    }
  }

  /**
   * Closes the automatic rating prompt for the remainder of this browser session.
   * @returns {void}
   * @sideEffects Stores a session-only prompt marker and closes the modal.
   */
  function closeFeedbackPrompt() {
    if (feedbackBooking) {
      const promptKey = "caregiver-feedback-prompt-" + feedbackBooking._id;
      window.sessionStorage.setItem(promptKey, "dismissed");
    }

    setFeedbackBooking(null);
  }

  /**
   * Adds newly submitted feedback to dashboard state without reloading the page.
   * @param {{review?: object, complaint?: object}} result - Saved API feedback result.
   * @returns {void}
   * @sideEffects Updates one booking in React state and closes the prompt.
   */
  function handleFeedbackSaved(result) {
    setCareState(function updateBookingFeedback(current) {
      const updatedBookings = [];

      for (const booking of current.bookings) {
        if (booking._id !== feedbackBooking?._id) {
          updatedBookings.push(booking);
          continue;
        }

        updatedBookings.push({
          ...booking,
          review: result.review || booking.review,
          complaint: result.complaint || booking.complaint,
        });
      }

      return {
        ...current,
        bookings: updatedBookings,
      };
    });
    closeFeedbackPrompt();
  }

  const activeBookings = getActiveBookings(careState.bookings);
  const pendingCount = countBookings(careState.bookings, ["pending"]);
  const assignedCount = countBookings(careState.bookings, ASSIGNED_STATUSES);
  const completedCount = countBookings(careState.bookings, ["completed"]);
  const unratedCompletedBookings = [];

  for (const booking of careState.bookings) {
    if (booking.status === "completed" && !booking.review) {
      unratedCompletedBookings.push(booking);
    }
  }
  const nextVisit = findNextCareVisit(careState.bookings);
  const visibleBookings = activeBookings.slice(0, 3);
  const visibleProfiles = careState.profiles.slice(0, 3);
  const hasPremium = Boolean(subscriptionState.data?.access?.isPremium);

  return (
    <main>
      <AppHeader />
      <div className="feature-page family-dashboard-page">
        <motion.section
          className="family-dashboard-hero"
          {...createRevealMotion(reduceMotion, { distance: 18 })}
        >
          <div>
            <div className="family-dashboard-hero__context">
              <span className="eyebrow">Family care workspace</span>
              <time dateTime={currentDate.toISOString()}>
                <CalendarIcon size={14} />
                {formatToday(currentDate)}
              </time>
            </div>
            <h1>{greeting}, {user.name}.</h1>
            <p>
              Keep care recipients, caregiver schedules, and health updates
              connected from one calm workspace.
            </p>
          </div>
          <div className="family-dashboard-hero__actions">
            <Link className="button button--primary" to="/caregivers">
              <UsersIcon size={17} />
              Find a caregiver
            </Link>
            <Link className="button button--secondary" to="/elderly-profiles">
              View care profiles
            </Link>
          </div>
        </motion.section>

        {careState.loading && (
          <div className="page-loader-inline">
            <span className="spinner" />
            Loading family care overview
          </div>
        )}
        {careState.error && <div className="alert alert--error">{careState.error}</div>}

        {unratedCompletedBookings.length > 0 && (
          <Link
            className="family-feedback-reminder"
            to={"/bookings?review=" + unratedCompletedBookings[0]._id}
          >
            <span>
              <StarIcon />
            </span>
            <div>
              <strong>
                {unratedCompletedBookings.length} completed booking
                {unratedCompletedBookings.length === 1 ? "" : "s"} awaiting feedback
              </strong>
              <small>
                Share an anonymous verified rating when you are ready.
              </small>
            </div>
            <ArrowRightIcon />
          </Link>
        )}

        <motion.section
          className="family-dashboard-metrics"
          aria-label="Family care summary"
          {...createRevealMotion(reduceMotion, { delay: 0.05, distance: 12 })}
        >
          <Card>
            <span className="family-dashboard-metric__icon" aria-hidden="true">
              <UsersIcon />
            </span>
            <div>
              <DashboardMetricValue
                value={careState.profiles.length}
                reduceMotion={reduceMotion}
              />
              <span>Care profiles</span>
            </div>
          </Card>
          <Card>
            <span className="family-dashboard-metric__icon" aria-hidden="true">
              <CalendarIcon />
            </span>
            <div>
              <DashboardMetricValue
                value={assignedCount}
                reduceMotion={reduceMotion}
              />
              <span>Assigned schedules</span>
            </div>
          </Card>
          <Card className={pendingCount ? "family-dashboard-metric--attention" : ""}>
            <span className="family-dashboard-metric__icon" aria-hidden="true">
              <ClockIcon />
            </span>
            <div>
              <DashboardMetricValue
                value={pendingCount}
                reduceMotion={reduceMotion}
              />
              <span>Awaiting response</span>
            </div>
          </Card>
          <Card>
            <span className="family-dashboard-metric__icon" aria-hidden="true">
              <ShieldCheckIcon />
            </span>
            <div>
              <DashboardMetricValue
                value={hasPremium ? "Premium" : "Core"}
                reduceMotion={reduceMotion}
              />
              <span>Current access</span>
            </div>
          </Card>
        </motion.section>

        <motion.div
          className="family-dashboard-primary-grid"
          {...createRevealMotion(reduceMotion, { delay: 0.08 })}
        >
          <Card className="family-next-care-card">
            <div className="family-dashboard-card-heading">
              <div><span className="eyebrow">Care calendar</span><h2>Next scheduled visit</h2></div>
              <CalendarIcon />
            </div>
            {nextVisit ? (
              <div className="family-next-care">
                <span className="profile-avatar">
                  {(nextVisit.booking.elderlyProfile?.name || "E")[0]}
                </span>
                <div>
                  <strong>{nextVisit.booking.elderlyProfile?.name || "Care recipient"}</strong>
                  <span>with {nextVisit.booking.caregiver?.name || "Caregiver"}</span>
                  <small>{nextVisit.booking.serviceType}</small>
                </div>
                <div className="family-next-care__schedule">
                  <span><CalendarIcon size={15} /> {displayDate(nextVisit.occurrence.date)}</span>
                  <span><ClockIcon size={15} /> {nextVisit.occurrence.timeSlot}</span>
                </div>
                <Link className="button button--secondary" to="/bookings">
                  Open booking
                  <ArrowRightIcon size={16} />
                </Link>
              </div>
            ) : (
              <div className="family-dashboard-empty">
                <CalendarIcon />
                <strong>No scheduled visit ahead</strong>
                <span>Accepted caregiver visits will appear here.</span>
                <Link to="/caregivers">Browse verified caregivers</Link>
              </div>
            )}
          </Card>

          <Card className="family-active-bookings-card">
            <div className="family-dashboard-card-heading">
              <div><span className="eyebrow">Live status</span><h2>Active bookings</h2></div>
              <span>{activeBookings.length}</span>
            </div>
            {!activeBookings.length ? (
              <div className="family-dashboard-empty">
                <ClockIcon />
                <strong>No active requests</strong>
                <span>Your pending and accepted bookings will appear here.</span>
              </div>
            ) : (
              <div className="family-dashboard-booking-list">
                {visibleBookings.map((booking) => (
                  <Link to="/bookings" key={booking._id}>
                    <div>
                      <strong>{booking.caregiver?.name || "Caregiver"}</strong>
                      <span>For {booking.elderlyProfile?.name || "care recipient"}</span>
                      <small><CalendarIcon size={13} /> {displayDate(booking.startDate)}</small>
                    </div>
                    <span className={"status-badge status-badge--" + booking.status}>
                      {booking.status}
                    </span>
                  </Link>
                ))}
              </div>
            )}
            <Link className="family-dashboard-card-link" to="/bookings">
              Manage all bookings
              <ArrowRightIcon size={16} />
            </Link>
          </Card>
        </motion.div>

        <motion.div
          className="family-dashboard-secondary-grid"
          {...createRevealMotion(reduceMotion, { delay: 0.1 })}
        >
          <Card className="family-profile-overview">
            <div className="family-dashboard-card-heading">
              <div><span className="eyebrow">Care recipients</span><h2>Elderly profiles</h2></div>
              <UsersIcon />
            </div>
            {!visibleProfiles.length ? (
              <div className="family-dashboard-empty">
                <UsersIcon />
                <strong>No care profile yet</strong>
                <Link to="/elderly-profiles/new">Create the first profile</Link>
              </div>
            ) : (
              <div className="family-dashboard-profile-list">
                {visibleProfiles.map((profile) => (
                  <Link to={"/elderly-profiles/" + profile._id} key={profile._id}>
                    <span className="profile-avatar">{getProfileName(profile)[0]}</span>
                    <div>
                      <strong>{getProfileName(profile)}</strong>
                      <small>{profile.personalInformation?.district || "Location not added"}</small>
                    </div>
                    <ArrowRightIcon size={16} />
                  </Link>
                ))}
              </div>
            )}
            <Link className="family-dashboard-card-link" to="/elderly-profiles">
              View all profiles
              <ArrowRightIcon size={16} />
            </Link>
          </Card>

          <section className="family-dashboard-quick-actions" aria-label="Family care actions">
            <Link to="/caregivers">
              <span><UsersIcon /></span>
              <div><strong>Caregiver network</strong><small>Compare services and availability</small></div>
              <ArrowRightIcon size={17} />
            </Link>
            <Link to="/elderly-profiles">
              <span><HeartPulseIcon /></span>
              <div><strong>Wellness and vitals</strong><small>Open a profile to review care reports</small></div>
              <ArrowRightIcon size={17} />
            </Link>
            <Link to="/subscription">
              <span><ShieldCheckIcon /></span>
              <div><strong>Subscription access</strong><small>Review plan and payment history</small></div>
              <ArrowRightIcon size={17} />
            </Link>
          </section>
        </motion.div>

        <motion.section
          className="family-dashboard-subscription"
          {...createRevealMotion(reduceMotion, { delay: 0.12 })}
        >
          <div className="family-dashboard-section-heading">
            <span className="eyebrow">Account access</span>
            <h2>Subscription overview</h2>
          </div>
          <SubscriptionStatusCard
            state={subscriptionState.data}
            loading={subscriptionState.loading}
          />
        </motion.section>

        <Card className="family-dashboard-completed-note">
          <BadgeCheckIcon />
          <div><strong>{completedCount} completed care booking{completedCount === 1 ? "" : "s"}</strong><span>Your completed and cancelled records remain available in Booking history.</span></div>
          <Link to="/bookings">Open history <ArrowRightIcon size={15} /></Link>
        </Card>
      </div>

      <SubscriptionExpiryModal
        reminder={subscriptionState.data?.reminder || null}
        onDismiss={dismissSubscriptionReminder}
        isDismissing={isDismissingReminder}
      />
      <CaregiverFeedbackModal
        booking={feedbackBooking}
        initialMode="review"
        onClose={closeFeedbackPrompt}
        onSaved={handleFeedbackSaved}
      />
    </main>
  );
}
