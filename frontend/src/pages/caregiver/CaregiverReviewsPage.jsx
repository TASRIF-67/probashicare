import { useEffect, useState } from "react";
import { Card } from "../../components/Card.jsx";
import { CaregiverHeader } from "../../components/caregiver/CaregiverHeader.jsx";
import {
  MessageIcon,
  ShieldCheckIcon,
  StarIcon,
} from "../../components/Icons.jsx";
import { Pagination } from "../../components/Pagination.jsx";
import { normalizeApiError } from "../../services/api.js";
import { caregiverFeedbackService } from "../../services/caregiverFeedbackService.js";

const REVIEWS_PER_PAGE = 3;
const STAR_VALUES = [1, 2, 3, 4, 5];

/**
 * Formats a stored review date for the caregiver.
 * @param {string|Date} value - Stored review creation date.
 * @returns {string} Localized medium date.
 * @sideEffects None.
 */
function formatDate(value) {
  return new Date(value).toLocaleDateString(undefined, {
    dateStyle: "medium",
  });
}

/**
 * Displays anonymous verified feedback received by an approved caregiver.
 * @returns {import("react").ReactElement} Paginated caregiver review workspace.
 * @sideEffects Loads protected review data when the page or pagination changes.
 */
export function CaregiverReviewsPage() {
  const [page, setPage] = useState(1);
  const [state, setState] = useState({
    loading: true,
    reviews: [],
    summary: {
      averageRating: 0,
      reviewCount: 0,
    },
    pagination: {
      page: 1,
      pages: 0,
      total: 0,
    },
    error: "",
  });

  useEffect(() => {
    let active = true;

    /**
     * Loads one page of privacy-safe caregiver feedback.
     * @returns {Promise<void>}
     * @sideEffects Calls the caregiver review API and updates page state.
     */
    async function loadReviews() {
      setState((current) => {
        return {
          ...current,
          loading: true,
          error: "",
        };
      });

      try {
        const result = await caregiverFeedbackService.listMyCaregiverReviews({
          page,
          limit: REVIEWS_PER_PAGE,
        });

        if (active) {
          setState({
            loading: false,
            reviews: result.reviews,
            summary: result.summary,
            pagination: result.pagination,
            error: "",
          });
        }
      } catch (requestError) {
        if (active) {
          setState((current) => {
            return {
              ...current,
              loading: false,
              error: normalizeApiError(requestError).message,
            };
          });
        }
      }
    }

    loadReviews();

    return function stopReviewLoad() {
      active = false;
    };
  }, [page]);

  return (
    <main>
      <CaregiverHeader />
      <div className="caregiver-page caregiver-reviews-page">
        <section className="caregiver-reviews-hero">
          <div>
            <span className="eyebrow">Verified family feedback</span>
            <h1>Your care reviews</h1>
            <p>
              Learn from completed-care feedback while family and elderly
              identities remain private.
            </p>
          </div>
          <div className="caregiver-rating-summary">
            <StarIcon />
            <div>
              <strong>
                {state.summary.reviewCount
                  ? state.summary.averageRating.toFixed(1)
                  : "New"}
              </strong>
              <span>
                {state.summary.reviewCount} verified review
                {state.summary.reviewCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </section>

        <div className="feedback-privacy-banner">
          <ShieldCheckIcon />
          <div>
            <strong>Privacy protected</strong>
            <span>
              Reviews confirm completed care, but never expose the family,
              care recipient, email, or booking identifier.
            </span>
          </div>
        </div>

        {state.loading && (
          <div className="page-loader-inline">
            <span className="spinner" />
            Loading feedback
          </div>
        )}
        {state.error && <div className="alert alert--error">{state.error}</div>}

        {!state.loading && !state.reviews.length && (
          <Card className="empty-state caregiver-reviews-empty">
            <MessageIcon />
            <h2>No feedback yet</h2>
            <p>
              Anonymous verified feedback will appear after a family rates
              completed care.
            </p>
          </Card>
        )}

        <div className="caregiver-review-list">
          {state.reviews.map((review) => (
            <Card className="caregiver-review-card" key={review.id}>
              <div className="caregiver-review-card__topline">
                <div className="caregiver-review-stars" aria-label={review.rating + " of 5 stars"}>
                  {STAR_VALUES.map((starValue) => (
                    <StarIcon
                      className={starValue <= review.rating ? "is-filled" : ""}
                      key={starValue}
                    />
                  ))}
                </div>
                <time dateTime={review.createdAt}>
                  {formatDate(review.createdAt)}
                </time>
              </div>
              <blockquote>
                {review.feedback || "The family submitted a rating without written feedback."}
              </blockquote>
              <span>
                <ShieldCheckIcon size={14} />
                {review.reviewerLabel}
              </span>
            </Card>
          ))}
        </div>

        <Pagination
          page={state.pagination.page}
          pages={state.pagination.pages}
          total={state.pagination.total}
          label="reviews"
          disabled={state.loading}
          onPageChange={setPage}
        />
      </div>
    </main>
  );
}
