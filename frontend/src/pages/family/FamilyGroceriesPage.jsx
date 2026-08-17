import { useEffect, useState } from "react";
import { AppHeader } from "../../components/AppHeader.jsx";
import { Button } from "../../components/Button.jsx";
import { Pagination } from "../../components/Pagination.jsx";
import { GroceryPurchaseModal } from "../../components/grocery/GroceryPurchaseModal.jsx";
import { GroceryRequestCard } from "../../components/grocery/GroceryRequestCard.jsx";
import { GroceryReviewModal } from "../../components/grocery/GroceryReviewModal.jsx";
import { ClipboardListIcon, UploadIcon } from "../../components/Icons.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { normalizeApiError } from "../../services/api.js";
import { groceryRequestService } from "../../services/groceryRequestService.js";

const ITEMS_PER_PAGE = 3;

/**
 * Checks whether a family request belongs in the selected workflow view.
 * @param {object} request - Grocery request record.
 * @param {string} view - review, progress, history, or all.
 * @returns {boolean} True when the request belongs in the view.
 * @sideEffects None.
 */
function requestMatchesView(request, view) {
  if (view === "all") {
    return true;
  }

  if (view === "review") {
    return request.status === "submitted";
  }

  const historyStatuses = ["delivered", "rejected", "cancelled"];

  if (view === "history") {
    return historyStatuses.includes(request.status);
  }

  return !historyStatuses.includes(request.status)
    && request.status !== "submitted";
}

/**
 * Displays family approvals, fulfilment progress, purchase records, and history.
 * @returns {import("react").ReactElement} Family essentials workspace.
 * @sideEffects Loads family-visible requests and performs authorized updates.
 */
export function FamilyGroceriesPage() {
  const { showToast } = useToast();
  const [requests, setRequests] = useState([]);
  const [view, setView] = useState("review");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [reviewRequest, setReviewRequest] = useState(null);
  const [purchaseRequest, setPurchaseRequest] = useState(null);

  /**
   * Reloads all grocery requests for family-authorized elderly profiles.
   * @returns {Promise<void>}
   * @sideEffects Calls the family grocery API and updates page state.
   */
  async function loadRequests() {
    setLoading(true);
    setError("");

    try {
      const data = await groceryRequestService.listFamilyRequests({
        page: 1,
        limit: 100,
      });
      setRequests(data.requests);
    } catch (requestError) {
      setError(normalizeApiError(requestError).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRequests();
  }, []);

  /**
   * Switches the family workflow view and returns to page one.
   * @param {string} nextView - review, progress, history, or all.
   * @returns {void}
   * @sideEffects Updates local filter and pagination state.
   */
  function changeView(nextView) {
    setView(nextView);
    setPage(1);
  }

  /**
   * Saves one family approval or rejection decision.
   * @param {object} payload - Review contract from the modal.
   * @returns {Promise<void>}
   * @sideEffects Calls the review API, reloads data, closes the modal, and shows feedback.
   */
  async function submitReview(payload) {
    if (!reviewRequest) {
      return;
    }

    setWorkingId(reviewRequest._id);
    setModalError("");

    try {
      const data = await groceryRequestService.reviewRequest(
        reviewRequest._id,
        payload,
      );
      await loadRequests();
      setReviewRequest(null);
      showToast(data.message, "success");
    } catch (requestError) {
      setModalError(normalizeApiError(requestError).message);
    } finally {
      setWorkingId("");
    }
  }

  /**
   * Records a family-arranged remote order.
   * @param {object} payload - Order and payment record contract.
   * @returns {Promise<void>}
   * @sideEffects Calls the family purchase API, reloads data, and shows feedback.
   */
  async function recordRemoteOrder(payload) {
    if (!purchaseRequest) {
      return;
    }

    setWorkingId(purchaseRequest._id);
    setModalError("");

    try {
      const data = await groceryRequestService.recordPurchase(
        "family",
        purchaseRequest._id,
        payload,
      );
      await loadRequests();
      setPurchaseRequest(null);
      showToast(data.message, "success");
    } catch (requestError) {
      setModalError(normalizeApiError(requestError).message);
    } finally {
      setWorkingId("");
    }
  }

  /**
   * Performs one permitted family workflow transition.
   * @param {string} requestId - GroceryRequest identifier.
   * @param {string} status - Requested next status.
   * @returns {Promise<void>}
   * @sideEffects Calls the status API, reloads data, and shows feedback.
   */
  async function changeStatus(requestId, status) {
    setWorkingId(requestId);
    setError("");

    try {
      const data = await groceryRequestService.updateStatus(
        "family",
        requestId,
        { status },
      );
      await loadRequests();
      showToast(data.message, "success");
    } catch (requestError) {
      const message = normalizeApiError(requestError).message;
      setError(message);
      showToast(message, "error");
    } finally {
      setWorkingId("");
    }
  }

  /**
   * Toggles the family's outside-app payment settlement audit flag.
   * @param {object} request - Grocery request record.
   * @returns {Promise<void>}
   * @sideEffects Calls the settlement API, reloads data, and shows feedback.
   */
  async function toggleSettlement(request) {
    setWorkingId(request._id);

    try {
      const data = await groceryRequestService.updateSettlement(
        request._id,
        !request.paymentSettled,
      );
      await loadRequests();
      showToast(data.message, "success");
    } catch (requestError) {
      showToast(normalizeApiError(requestError).message, "error");
    } finally {
      setWorkingId("");
    }
  }

  /**
   * Uploads optional purchase evidence from a family request card.
   * @param {string} requestId - GroceryRequest identifier.
   * @param {import("react").ChangeEvent<HTMLInputElement>} event - File input event.
   * @returns {Promise<void>}
   * @sideEffects Uploads the file, clears input, reloads data, and shows feedback.
   */
  async function uploadReceipt(requestId, event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setWorkingId(requestId);

    try {
      const data = await groceryRequestService.uploadReceipt(
        "family",
        requestId,
        file,
      );
      await loadRequests();
      showToast(data.message, "success");
    } catch (requestError) {
      showToast(normalizeApiError(requestError).message, "error");
    } finally {
      event.target.value = "";
      setWorkingId("");
    }
  }

  const filteredRequests = [];

  for (const request of requests) {
    if (requestMatchesView(request, view)) {
      filteredRequests.push(request);
    }
  }

  const pages = Math.max(1, Math.ceil(filteredRequests.length / ITEMS_PER_PAGE));
  const visiblePage = Math.min(page, pages);
  const startIndex = (visiblePage - 1) * ITEMS_PER_PAGE;
  const visibleRequests = filteredRequests.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE,
  );
  let reviewCount = 0;

  for (const request of requests) {
    if (request.status === "submitted") {
      reviewCount += 1;
    }
  }

  return (
    <main>
      <AppHeader />
      <div className="dashboard-page grocery-page">
        <div className="page-heading grocery-page-heading">
          <span className="eyebrow">Household coordination</span>
          <h1>Groceries and essentials</h1>
          <p>
            Review caregiver requests, choose who will purchase, record BDT
            spending, and keep completed requests in one history.
          </p>
        </div>
        <div className="grocery-family-summary">
          <div>
            <span>Waiting for you</span>
            <strong>{reviewCount}</strong>
          </div>
          <p>
            Store-map results help with discovery only. Confirm price, stock,
            hours, and delivery directly with the local seller.
          </p>
        </div>
        <div className="grocery-view-tabs" role="group" aria-label="Request view">
          {[
            { value: "review", label: `Needs review (${reviewCount})` },
            { value: "progress", label: "In progress" },
            { value: "history", label: "History" },
            { value: "all", label: "All requests" },
          ].map((option) => (
            <button
              type="button"
              className={view === option.value ? "is-active" : ""}
              aria-pressed={view === option.value}
              key={option.value}
              onClick={() => changeView(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {loading && (
          <div className="page-loader-inline">
            <span className="spinner" />
            Loading essentials requests
          </div>
        )}
        {error && <div className="alert alert--error">{error}</div>}
        {!loading && visibleRequests.length === 0 && (
          <div className="grocery-empty-state">
            <ClipboardListIcon size={28} />
            <h2>No requests in this view</h2>
            <p>Caregiver requests and their full progress will appear here.</p>
          </div>
        )}
        <div className="grocery-request-grid">
          {visibleRequests.map((request) => {
            const canEdit = request.familyPermission === "owner"
              || request.familyPermission === "editor";
            const canUpload = [
              "purchased",
              "ordered",
              "out-for-delivery",
              "delivered",
            ].includes(request.status);

            return (
              <GroceryRequestCard
                request={request}
                key={request._id}
                actions={canEdit ? (
                  <>
                    {request.status === "submitted" && (
                      <Button onClick={() => {
                        setModalError("");
                        setReviewRequest(request);
                      }}>
                        Review request
                      </Button>
                    )}
                    {request.status === "approved"
                      && request.fulfillmentMethod === "family-remote-order" && (
                        <Button onClick={() => {
                          setModalError("");
                          setPurchaseRequest(request);
                        }}>
                          Record remote order
                        </Button>
                      )}
                    {request.status === "approved" && (
                      <Button
                        variant="ghost"
                        isLoading={workingId === request._id}
                        onClick={() => changeStatus(request._id, "cancelled")}
                      >
                        Cancel approved request
                      </Button>
                    )}
                    {request.status === "ordered" && (
                      <Button
                        variant="secondary"
                        isLoading={workingId === request._id}
                        onClick={() => changeStatus(request._id, "out-for-delivery")}
                      >
                        Mark out for delivery
                      </Button>
                    )}
                    {["purchased", "out-for-delivery"].includes(request.status) && (
                      <Button
                        isLoading={workingId === request._id}
                        onClick={() => changeStatus(request._id, "delivered")}
                      >
                        Confirm delivered
                      </Button>
                    )}
                    {request.actualTotal !== null && (
                      <Button
                        variant="secondary"
                        isLoading={workingId === request._id}
                        onClick={() => toggleSettlement(request)}
                      >
                        {request.paymentSettled ? "Mark payment unsettled" : "Mark payment settled"}
                      </Button>
                    )}
                    {canUpload && (
                      <label className="button button--secondary grocery-upload-button">
                        <UploadIcon size={17} />
                        {request.receipt ? "Replace receipt" : "Add receipt"}
                        <input
                          type="file"
                          accept=".pdf,image/jpeg,image/png"
                          disabled={workingId === request._id}
                          onChange={(event) => uploadReceipt(request._id, event)}
                        />
                      </label>
                    )}
                  </>
                ) : (
                  <span className="field-hint">Viewer access: actions are read-only.</span>
                )}
              />
            );
          })}
        </div>
        <Pagination
          page={visiblePage}
          pages={pages}
          total={filteredRequests.length}
          label="requests"
          disabled={loading}
          onPageChange={setPage}
        />
      </div>
      <GroceryReviewModal
        request={reviewRequest}
        isSubmitting={Boolean(reviewRequest) && workingId === reviewRequest._id}
        error={modalError}
        onClose={() => setReviewRequest(null)}
        onSubmit={submitReview}
      />
      <GroceryPurchaseModal
        request={purchaseRequest}
        role="family"
        isSubmitting={Boolean(purchaseRequest) && workingId === purchaseRequest._id}
        error={modalError}
        onClose={() => setPurchaseRequest(null)}
        onSubmit={recordRemoteOrder}
      />
    </main>
  );
}
