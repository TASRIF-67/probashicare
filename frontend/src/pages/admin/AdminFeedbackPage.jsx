import { useEffect, useState } from "react";
import { Button } from "../../components/Button.jsx";
import { Card } from "../../components/Card.jsx";
import {
  FlagIcon,
  MessageIcon,
  ShieldCheckIcon,
  StarIcon,
} from "../../components/Icons.jsx";
import { Pagination } from "../../components/Pagination.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { adminService } from "../../services/adminService.js";
import { normalizeApiError } from "../../services/api.js";

const RECORDS_PER_PAGE = 3;
const STAR_VALUES = [1, 2, 3, 4, 5];

const REVIEW_STATUS_OPTIONS = [
  {
    value: "all",
    label: "All reviews",
  },
  {
    value: "published",
    label: "Published",
  },
  {
    value: "hidden",
    label: "Hidden",
  },
];

const COMPLAINT_STATUS_OPTIONS = [
  {
    value: "all",
    label: "All complaints",
  },
  {
    value: "open",
    label: "Open",
  },
  {
    value: "under-review",
    label: "Under review",
  },
  {
    value: "resolved",
    label: "Resolved",
  },
];

/**
 * Converts a stored hyphenated status into readable text.
 * @param {string} value - Stored status or category value.
 * @returns {string} Capitalized readable label.
 * @sideEffects None.
 */
function humanize(value) {
  const text = String(value || "").replaceAll("-", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Formats a stored feedback date for administrator review.
 * @param {string|Date} value - Stored creation date.
 * @returns {string} Localized date and time.
 * @sideEffects None.
 */
function formatDateTime(value) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Provides attributed caregiver rating moderation and complaint investigation.
 * @returns {import("react").ReactElement} Paginated administrator feedback workspace.
 * @sideEffects Loads feedback and may update review visibility or complaint status.
 */
export function AdminFeedbackPage() {
  const { showToast } = useToast();
  const [view, setView] = useState("reviews");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [responseDrafts, setResponseDrafts] = useState({});
  const [complaintStatuses, setComplaintStatuses] = useState({});
  const [state, setState] = useState({
    loading: true,
    records: [],
    summary: {},
    pagination: {
      page: 1,
      pages: 0,
      total: 0,
    },
    busyId: "",
    error: "",
  });

  /**
   * Loads the active review or complaint page using current filters.
   * @returns {Promise<void>}
   * @sideEffects Calls an administrator API and replaces workspace state.
   */
  async function loadFeedback() {
    setState((current) => {
      return {
        ...current,
        loading: true,
        error: "",
      };
    });

    try {
      let result;

      if (view === "reviews") {
        result = await adminService.listCaregiverReviews({
          status,
          page,
          limit: RECORDS_PER_PAGE,
        });
      } else {
        result = await adminService.listCaregiverComplaints({
          status,
          page,
          limit: RECORDS_PER_PAGE,
        });
      }

      const records = view === "reviews"
        ? result.reviews
        : result.complaints;
      setState({
        loading: false,
        records,
        summary: result.summary,
        pagination: result.pagination,
        busyId: "",
        error: "",
      });

      if (view === "complaints") {
        const nextResponseDrafts = {};
        const nextComplaintStatuses = {};

        for (const complaint of result.complaints) {
          nextResponseDrafts[complaint.id] = complaint.adminResponse || "";
          nextComplaintStatuses[complaint.id] = complaint.status;
        }

        setResponseDrafts(nextResponseDrafts);
        setComplaintStatuses(nextComplaintStatuses);
      }
    } catch (requestError) {
      setState((current) => {
        return {
          ...current,
          loading: false,
          busyId: "",
          error: normalizeApiError(requestError).message,
        };
      });
    }
  }

  useEffect(() => {
    loadFeedback();
  }, [view, status, page]);

  /**
   * Switches between review moderation and private complaints.
   * @param {"reviews"|"complaints"} nextView - Administrator workspace view.
   * @returns {void}
   * @sideEffects Resets filter and pagination state.
   */
  function changeView(nextView) {
    setView(nextView);
    setStatus("all");
    setPage(1);
  }

  /**
   * Applies one status filter and returns to the first result page.
   * @param {import("react").ChangeEvent<HTMLSelectElement>} event - Status selection event.
   * @returns {void}
   * @sideEffects Updates status and pagination state.
   */
  function changeStatus(event) {
    setStatus(event.target.value);
    setPage(1);
  }

  /**
   * Shows or hides one caregiver review from non-admin views.
   * @param {object} review - Review selected for moderation.
   * @returns {Promise<void>}
   * @sideEffects Calls the moderation API, displays a toast, and reloads records.
   */
  async function moderateReview(review) {
    const nextStatus = review.moderationStatus === "published"
      ? "hidden"
      : "published";
    setState((current) => {
      return {
        ...current,
        busyId: review.id,
        error: "",
      };
    });

    try {
      const result = await adminService.moderateCaregiverReview(
        review.id,
        nextStatus,
      );
      showToast(result.message, "success");
      await loadFeedback();
    } catch (requestError) {
      setState((current) => {
        return {
          ...current,
          busyId: "",
          error: normalizeApiError(requestError).message,
        };
      });
    }
  }

  /**
   * Updates the drafted administrator response for one complaint.
   * @param {string} complaintId - Complaint being edited.
   * @param {string} value - Current response text.
   * @returns {void}
   * @sideEffects Updates local response draft state.
   */
  function changeResponse(complaintId, value) {
    setResponseDrafts((current) => {
      return {
        ...current,
        [complaintId]: value,
      };
    });
  }

  /**
   * Updates the selected workflow status for one complaint.
   * @param {string} complaintId - Complaint being edited.
   * @param {string} value - New selected workflow status.
   * @returns {void}
   * @sideEffects Updates local complaint status state.
   */
  function changeComplaintStatus(complaintId, value) {
    setComplaintStatuses((current) => {
      return {
        ...current,
        [complaintId]: value,
      };
    });
  }

  /**
   * Saves one complaint investigation update.
   * @param {object} complaint - Complaint selected for update.
   * @returns {Promise<void>}
   * @sideEffects Calls the API, notifies the family, displays a toast, and reloads.
   */
  async function updateComplaint(complaint) {
    const nextStatus = complaintStatuses[complaint.id] || complaint.status;
    const adminResponse = responseDrafts[complaint.id] || "";
    setState((current) => {
      return {
        ...current,
        busyId: complaint.id,
        error: "",
      };
    });

    try {
      const result = await adminService.updateCaregiverComplaint(
        complaint.id,
        {
          status: nextStatus,
          adminResponse,
        },
      );
      showToast(result.message, "success");
      await loadFeedback();
    } catch (requestError) {
      setState((current) => {
        return {
          ...current,
          busyId: "",
          error: normalizeApiError(requestError).message,
        };
      });
    }
  }

  const statusOptions = view === "reviews"
    ? REVIEW_STATUS_OPTIONS
    : COMPLAINT_STATUS_OPTIONS;

  return (
    <div className="admin-feedback-page">
      <div className="admin-page-heading">
        <div>
          <span className="eyebrow">Care quality</span>
          <h1>Ratings and complaints</h1>
          <p>
            Moderate attributed feedback and investigate private family concerns
            without exposing identities to caregivers.
          </p>
        </div>
      </div>

      <nav className="admin-feedback-tabs" aria-label="Feedback workspace">
        <button
          type="button"
          className={view === "reviews" ? "is-active" : ""}
          aria-pressed={view === "reviews"}
          onClick={() => {
            changeView("reviews");
          }}
        >
          <StarIcon />
          Verified reviews
        </button>
        <button
          type="button"
          className={view === "complaints" ? "is-active" : ""}
          aria-pressed={view === "complaints"}
          onClick={() => {
            changeView("complaints");
          }}
        >
          <FlagIcon />
          Private complaints
        </button>
      </nav>

      <section className="admin-feedback-summary" aria-label="Feedback summary">
        {Object.keys(state.summary).map((summaryKey) => (
          <div key={summaryKey}>
            <span>{humanize(summaryKey)}</span>
            <strong>{state.summary[summaryKey]}</strong>
          </div>
        ))}
      </section>

      <div className="admin-feedback-toolbar">
        <label className="field">
          <span>Status</span>
          <select
            className="input"
            value={status}
            disabled={state.loading}
            onChange={changeStatus}
          >
            {statusOptions.map((option) => (
              <option value={option.value} key={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {state.loading && (
        <div className="page-loader-inline">
          <span className="spinner" />
          Loading feedback records
        </div>
      )}
      {state.error && <div className="alert alert--error">{state.error}</div>}

      {!state.loading && !state.records.length && (
        <Card className="empty-state admin-feedback-empty">
          <MessageIcon />
          <h2>No feedback matches this view</h2>
          <p>New completed-care feedback will appear here.</p>
        </Card>
      )}

      <div className="admin-feedback-list">
        {view === "reviews" && state.records.map((review) => (
          <Card className="admin-feedback-card" key={review.id}>
            <div className="admin-feedback-card__heading">
              <div>
                <div className="caregiver-review-stars" aria-label={review.rating + " of 5 stars"}>
                  {STAR_VALUES.map((starValue) => (
                    <StarIcon
                      className={starValue <= review.rating ? "is-filled" : ""}
                      key={starValue}
                    />
                  ))}
                </div>
                <h2>{review.caregiver?.name || "Caregiver"}</h2>
                <span>
                  Reviewed by {review.family?.name || "Family account"}
                  {" · "}
                  {review.elderlyProfile?.name || "Care recipient"}
                </span>
              </div>
              <span className={"status-badge status-badge--" + review.moderationStatus}>
                {humanize(review.moderationStatus)}
              </span>
            </div>
            <blockquote>
              {review.feedback || "Rating submitted without written feedback."}
            </blockquote>
            <div className="admin-feedback-card__meta">
              <span>{review.family?.email}</span>
              <time dateTime={review.createdAt}>
                {formatDateTime(review.createdAt)}
              </time>
            </div>
            <div className="admin-feedback-card__actions">
              <span>
                <ShieldCheckIcon size={15} />
                Family attribution is visible only to administrators.
              </span>
              <Button
                variant="secondary"
                isLoading={state.busyId === review.id}
                disabled={Boolean(state.busyId)}
                onClick={() => {
                  moderateReview(review);
                }}
              >
                {review.moderationStatus === "published"
                  ? "Hide review"
                  : "Publish review"}
              </Button>
            </div>
          </Card>
        ))}

        {view === "complaints" && state.records.map((complaint) => (
          <Card className="admin-feedback-card admin-complaint-card" key={complaint.id}>
            <div className="admin-feedback-card__heading">
              <div>
                <span className="eyebrow">{humanize(complaint.category)}</span>
                <h2>{complaint.caregiver?.name || "Caregiver"}</h2>
                <span>
                  Reported by {complaint.family?.name || "Family account"}
                  {" · "}
                  {complaint.elderlyProfile?.name || "Care recipient"}
                </span>
              </div>
              <span className={"status-badge status-badge--" + complaint.status}>
                {humanize(complaint.status)}
              </span>
            </div>
            <p className="admin-complaint-description">{complaint.description}</p>
            <div className="admin-feedback-card__meta">
              <span>{complaint.family?.email}</span>
              <time dateTime={complaint.createdAt}>
                {formatDateTime(complaint.createdAt)}
              </time>
            </div>
            <div className="admin-complaint-resolution">
              <label className="field">
                <span>Investigation status</span>
                <select
                  className="input"
                  value={complaintStatuses[complaint.id] || complaint.status}
                  disabled={Boolean(state.busyId)}
                  onChange={(event) => {
                    changeComplaintStatus(complaint.id, event.target.value);
                  }}
                >
                  <option value="open">Open</option>
                  <option value="under-review">Under review</option>
                  <option value="resolved">Resolved</option>
                </select>
              </label>
              <label className="field">
                <span>Administrator response</span>
                <textarea
                  className="input textarea"
                  rows={4}
                  maxLength={2000}
                  value={responseDrafts[complaint.id] || ""}
                  disabled={Boolean(state.busyId)}
                  placeholder="Record findings and explain the resolution to the family."
                  onChange={(event) => {
                    changeResponse(complaint.id, event.target.value);
                  }}
                />
              </label>
              <Button
                isLoading={state.busyId === complaint.id}
                disabled={Boolean(state.busyId)}
                onClick={() => {
                  updateComplaint(complaint);
                }}
              >
                Save investigation
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Pagination
        page={state.pagination.page}
        pages={state.pagination.pages}
        total={state.pagination.total}
        label={view}
        disabled={state.loading}
        onPageChange={setPage}
      />
    </div>
  );
}
