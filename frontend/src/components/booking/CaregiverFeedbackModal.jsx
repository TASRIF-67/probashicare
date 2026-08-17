import { useEffect, useState } from "react";
import { Button } from "../Button.jsx";
import {
  FlagIcon,
  MessageIcon,
  ShieldCheckIcon,
  StarIcon,
} from "../Icons.jsx";
import { Modal } from "../Modal.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { normalizeApiError } from "../../services/api.js";
import { caregiverFeedbackService } from "../../services/caregiverFeedbackService.js";

const COMPLAINT_CATEGORIES = [
  {
    value: "care-quality",
    label: "Care quality",
  },
  {
    value: "attendance",
    label: "Attendance",
  },
  {
    value: "communication",
    label: "Communication",
  },
  {
    value: "conduct",
    label: "Conduct",
  },
  {
    value: "payment",
    label: "Payment",
  },
  {
    value: "safety",
    label: "Safety",
  },
  {
    value: "other",
    label: "Other",
  },
];
const STAR_VALUES = [1, 2, 3, 4, 5];

/**
 * Converts a stored hyphenated value into readable text.
 * @param {string} value - Stored category or status value.
 * @returns {string} Capitalized readable text.
 * @sideEffects None.
 */
function humanize(value) {
  const text = String(value || "").replaceAll("-", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Returns an accessible label for one rating button.
 * @param {number} value - Star number from one to five.
 * @returns {string} Singular or plural star label.
 * @sideEffects None.
 */
function getStarLabel(value) {
  if (value === 1) {
    return "1 star";
  }

  return value + " stars";
}

/**
 * Renders a completed-booking review or private complaint dialog.
 * @param {{booking: object|null, initialMode?: "review"|"complaint", onClose: () => void, onSaved: (result: object) => Promise<void>|void}} props - Selected booking and result handlers.
 * @returns {import("react").ReactElement|null} Feedback dialog for a selected booking.
 * @sideEffects Submits review or complaint APIs and displays toast feedback.
 */
export function CaregiverFeedbackModal({
  booking,
  initialMode = "review",
  onClose,
  onSaved,
}) {
  const { showToast } = useToast();
  const [mode, setMode] = useState(initialMode);
  const [rating, setRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [category, setCategory] = useState("care-quality");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setRating(0);
    setFeedback("");
    setCategory("care-quality");
    setDescription("");
    setError("");
    setIsSubmitting(false);
  }, [booking?._id, initialMode]);

  if (!booking) {
    return null;
  }

  const hasReview = Boolean(booking.review);
  const hasComplaint = Boolean(booking.complaint);
  let title = "Rate completed care";

  if (mode === "complaint") {
    title = hasComplaint ? "Complaint status" : "Report a private concern";
  } else if (hasReview) {
    title = "Your caregiver feedback";
  }

  /**
   * Selects a star rating.
   * @param {number} value - Star value selected by the family.
   * @returns {void}
   * @sideEffects Updates local form state and clears feedback errors.
   */
  function chooseRating(value) {
    setRating(value);
    setError("");
  }

  /**
   * Opens the rating section in the same dialog.
   * @returns {void}
   * @sideEffects Changes local dialog mode.
   */
  function showReviewForm() {
    setMode("review");
    setError("");
  }

  /**
   * Opens the private complaint section in the same dialog.
   * @returns {void}
   * @sideEffects Changes local dialog mode.
   */
  function showComplaintForm() {
    setMode("complaint");
    setError("");
  }

  /**
   * Submits a verified review for the selected completed booking.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Review form submission.
   * @returns {Promise<void>}
   * @sideEffects Prevents navigation, calls the API, refreshes parent data, and shows a toast.
   */
  async function submitReview(event) {
    event.preventDefault();

    if (rating < 1 || rating > 5) {
      setError("Choose a rating from 1 to 5 stars.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const result = await caregiverFeedbackService.submitReview(
        booking._id,
        {
          rating,
          feedback,
        },
      );
      showToast(result.message, "success");
      await onSaved(result);
    } catch (requestError) {
      setError(normalizeApiError(requestError).message);
      setIsSubmitting(false);
    }
  }

  /**
   * Submits a private complaint for administrator investigation.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Complaint form submission.
   * @returns {Promise<void>}
   * @sideEffects Prevents navigation, calls the API, refreshes parent data, and shows a toast.
   */
  async function submitComplaint(event) {
    event.preventDefault();
    const trimmedDescription = description.trim();

    if (trimmedDescription.length < 20) {
      setError("Explain the concern using at least 20 characters.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const result = await caregiverFeedbackService.submitComplaint(
        booking._id,
        {
          category,
          description: trimmedDescription,
        },
      );
      showToast(result.message, "success");
      await onSaved(result);
    } catch (requestError) {
      setError(normalizeApiError(requestError).message);
      setIsSubmitting(false);
    }
  }

  let content;

  if (mode === "review" && hasReview) {
    content = (
      <div className="feedback-existing">
        <div className="feedback-existing__rating" aria-label={getStarLabel(booking.review.rating)}>
          {STAR_VALUES.map((starValue) => {
            const className = starValue <= booking.review.rating
              ? "feedback-star feedback-star--selected"
              : "feedback-star";

            return <StarIcon className={className} key={starValue} />;
          })}
        </div>
        <strong>Thank you for sharing verified feedback.</strong>
        <p>
          {booking.review.feedback || "You submitted a rating without written feedback."}
        </p>
        <small>
          The caregiver sees this anonymously. Administrators retain booking
          attribution for moderation.
        </small>
      </div>
    );
  } else if (mode === "complaint" && hasComplaint) {
    content = (
      <div className="feedback-existing complaint-status-panel">
        <span className={"status-badge status-badge--" + booking.complaint.status}>
          {humanize(booking.complaint.status)}
        </span>
        <strong>{humanize(booking.complaint.category)}</strong>
        <p>{booking.complaint.description}</p>
        {booking.complaint.adminResponse && (
          <div>
            <small>Administrator response</small>
            <p>{booking.complaint.adminResponse}</p>
          </div>
        )}
      </div>
    );
  } else if (mode === "complaint") {
    content = (
      <form className="feedback-form" onSubmit={submitComplaint}>
        <div className="feedback-privacy-note">
          <ShieldCheckIcon />
          <p>
            Complaints are private. They are sent to administrators and are not
            published as caregiver feedback.
          </p>
        </div>
        <label className="field">
          <span>Concern category</span>
          <select
            className="input"
            value={category}
            disabled={isSubmitting}
            onChange={(event) => {
              setCategory(event.target.value);
            }}
          >
            {COMPLAINT_CATEGORIES.map((option) => {
              return (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              );
            })}
          </select>
        </label>
        <label className="field">
          <span>What happened?</span>
          <textarea
            className="input textarea"
            value={description}
            minLength={20}
            maxLength={2000}
            rows={6}
            disabled={isSubmitting}
            placeholder="Give administrators enough detail to investigate the completed care."
            onChange={(event) => {
              setDescription(event.target.value);
            }}
          />
          <small className="field__hint">{description.length}/2000 characters</small>
        </label>
        {error && <div className="alert alert--error">{error}</div>}
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            <FlagIcon size={16} />
            Send privately
          </Button>
        </div>
      </form>
    );
  } else {
    content = (
      <form className="feedback-form" onSubmit={submitReview}>
        <div className="feedback-rating-question">
          <strong>How was the completed care?</strong>
          <span>
            Your name and the care recipient are hidden from the caregiver.
          </span>
        </div>
        <div className="feedback-star-picker" role="group" aria-label="Caregiver rating">
          {STAR_VALUES.map((value) => {
            const className = value <= rating
              ? "feedback-star-button feedback-star-button--selected"
              : "feedback-star-button";

            return (
              <button
                type="button"
                className={className}
                aria-label={getStarLabel(value)}
                aria-pressed={rating === value}
                disabled={isSubmitting}
                key={value}
                onClick={() => {
                  chooseRating(value);
                }}
              >
                <StarIcon />
                <span>{value}</span>
              </button>
            );
          })}
        </div>
        <label className="field">
          <span>Written feedback <small>Optional</small></span>
          <textarea
            className="input textarea"
            value={feedback}
            maxLength={1500}
            rows={5}
            disabled={isSubmitting}
            placeholder="Share what went well or what could be improved."
            onChange={(event) => {
              setFeedback(event.target.value);
            }}
          />
          <small className="field__hint">{feedback.length}/1500 characters</small>
        </label>
        {error && <div className="alert alert--error">{error}</div>}
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Maybe later
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            <MessageIcon size={16} />
            Submit feedback
          </Button>
        </div>
      </form>
    );
  }

  return (
    <Modal
      isOpen={Boolean(booking)}
      title={title}
      className="caregiver-feedback-modal"
      onClose={onClose}
    >
      <div className="feedback-booking-summary">
        <span className="profile-avatar">
          {(booking.caregiver?.name || "C")[0]}
        </span>
        <div>
          <strong>{booking.caregiver?.name || "Caregiver"}</strong>
          <span>
            {humanize(booking.serviceType)}
            {" · "}
            {booking.elderlyProfile?.name || "Care recipient"}
          </span>
        </div>
      </div>

      <nav className="feedback-mode-tabs" aria-label="Feedback options">
        <button
          type="button"
          className={mode === "review" ? "is-active" : ""}
          aria-pressed={mode === "review"}
          onClick={showReviewForm}
        >
          <StarIcon size={16} />
          Rating and feedback
        </button>
        <button
          type="button"
          className={mode === "complaint" ? "is-active" : ""}
          aria-pressed={mode === "complaint"}
          onClick={showComplaintForm}
        >
          <FlagIcon size={16} />
          Private complaint
        </button>
      </nav>

      {content}
    </Modal>
  );
}
