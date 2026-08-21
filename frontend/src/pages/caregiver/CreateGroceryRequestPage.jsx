import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CaregiverHeader } from "../../components/caregiver/CaregiverHeader.jsx";
import { GroceryRequestForm } from "../../components/grocery/GroceryRequestModal.jsx";
import {
  ArrowLeftIcon,
  ClipboardListIcon,
  ShoppingBasketIcon,
} from "../../components/Icons.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { normalizeApiError } from "../../services/api.js";
import { groceryRequestService } from "../../services/groceryRequestService.js";

/**
 * Displays a dedicated workspace for creating an essentials request.
 * @returns {import("react").ReactElement} Full-page caregiver request experience.
 * @sideEffects Loads caregiver assignments, creates a request, shows feedback, and navigates.
 */
export function CreateGroceryRequestPage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [assignments, setAssignments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;

    /**
     * Loads care assignments that are allowed to receive grocery requests.
     * @returns {Promise<void>}
     * @sideEffects Calls the assignment API and updates page state.
     */
    async function loadAssignments() {
      setIsLoading(true);

      try {
        const data = await groceryRequestService.listAssignments();

        if (isActive) {
          setAssignments(data.assignments || []);
          setError("");
        }
      } catch (requestError) {
        if (isActive) {
          setError(normalizeApiError(requestError).message);
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    }

    loadAssignments();

    return function stopAssignmentLoad() {
      isActive = false;
    };
  }, []);

  /**
   * Creates the request and returns to the essentials workspace.
   * @param {object} payload - Existing grocery request API contract.
   * @returns {Promise<void>}
   * @sideEffects Calls the create API, shows a toast, and changes routes.
   */
  async function createRequest(payload) {
    setIsSubmitting(true);
    setError("");

    try {
      const data = await groceryRequestService.createRequest(payload);
      showToast(data.message, "success");
      navigate("/caregiver/groceries");
    } catch (requestError) {
      const message = normalizeApiError(requestError).message;
      setError(message);
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main>
      <CaregiverHeader />
      <div className="caregiver-page grocery-create-page">
        <Link className="profile-back-link" to="/caregiver/groceries">
          <ArrowLeftIcon size={17} />
          Back to essentials
        </Link>

        <div className="page-heading grocery-create-heading">
          <span className="eyebrow">New household request</span>
          <h1>Request groceries or essentials</h1>
          <p>
            Build a clear list for one care recipient. The family can review
            the request, decide how it will be purchased, and follow its status.
          </p>
        </div>

        {isLoading && (
          <div className="page-loader-inline">
            <span className="spinner" />
            Loading care assignments
          </div>
        )}

        {!isLoading && assignments.length === 0 && (
          <section className="grocery-create-empty">
            <ClipboardListIcon size={30} />
            <h2>No eligible care assignment</h2>
            <p>
              You need a scheduled, active, or completed assignment before
              creating an essentials request.
            </p>
            <Link className="button button--secondary" to="/caregiver/bookings">
              View bookings
            </Link>
          </section>
        )}

        {!isLoading && assignments.length > 0 && (
          <div className="grocery-create-layout">
            <section className="grocery-create-form-card">
              <GroceryRequestForm
                assignments={assignments}
                isSubmitting={isSubmitting}
                error={error}
                resetKey="grocery-request-page"
                onCancel={() => navigate("/caregiver/groceries")}
                onSubmit={createRequest}
              />
            </section>
            <aside className="grocery-create-guide">
              <span aria-hidden="true">
                <ShoppingBasketIcon size={22} />
              </span>
              <h2>Keep the request easy to review</h2>
              <ul>
                <li>Use a separate row for every item.</li>
                <li>Add a familiar unit such as kg, packet, or bottle.</li>
                <li>Mark urgent only when the item is needed quickly.</li>
                <li>A receipt remains optional for local purchases.</li>
              </ul>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
