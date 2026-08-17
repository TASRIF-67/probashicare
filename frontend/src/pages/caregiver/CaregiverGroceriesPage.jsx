import { useEffect, useState } from "react";
import { Button } from "../../components/Button.jsx";
import { Pagination } from "../../components/Pagination.jsx";
import { CaregiverHeader } from "../../components/caregiver/CaregiverHeader.jsx";
import { GroceryPurchaseModal } from "../../components/grocery/GroceryPurchaseModal.jsx";
import { GroceryRequestCard } from "../../components/grocery/GroceryRequestCard.jsx";
import { GroceryRequestModal } from "../../components/grocery/GroceryRequestModal.jsx";
import { ClipboardListIcon, PlusIcon, UploadIcon } from "../../components/Icons.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { normalizeApiError } from "../../services/api.js";
import { groceryRequestService } from "../../services/groceryRequestService.js";

const ITEMS_PER_PAGE = 3;

/**
 * Checks whether a caregiver request belongs in the selected workspace view.
 * @param {object} request - Grocery request record.
 * @param {string} view - all, active, or history.
 * @returns {boolean} True when the request belongs in the view.
 * @sideEffects None.
 */
function requestMatchesView(request, view) {
  if (view === "all") {
    return true;
  }

  const finishedStatuses = ["delivered", "rejected", "cancelled"];

  if (view === "history") {
    return finishedStatuses.includes(request.status);
  }

  return !finishedStatuses.includes(request.status);
}

/**
 * Displays caregiver grocery requests, progress actions, and optional evidence.
 * @returns {import("react").ReactElement} Caregiver essentials workspace.
 * @sideEffects Loads assignments and requests and performs authenticated updates.
 */
export function CaregiverGroceriesPage() {
  const { showToast } = useToast();
  const [assignments, setAssignments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [view, setView] = useState("active");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState("");
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [purchaseRequest, setPurchaseRequest] = useState(null);

  /**
   * Reloads the complete manageable caregiver request list and assignments.
   * @returns {Promise<void>}
   * @sideEffects Calls two authenticated APIs and updates page state.
   */
  async function loadWorkspace() {
    setLoading(true);
    setError("");

    try {
      const [assignmentData, requestData] = await Promise.all([
        groceryRequestService.listAssignments(),
        groceryRequestService.listCaregiverRequests({ page: 1, limit: 100 }),
      ]);
      setAssignments(assignmentData.assignments);
      setRequests(requestData.requests);
    } catch (requestError) {
      setError(normalizeApiError(requestError).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadWorkspace();
  }, []);

  /**
   * Switches the active/history request view and returns to page one.
   * @param {string} nextView - all, active, or history.
   * @returns {void}
   * @sideEffects Updates local filter and pagination state.
   */
  function changeView(nextView) {
    setView(nextView);
    setPage(1);
  }

  /**
   * Creates a caregiver request and refreshes the workspace.
   * @param {object} payload - Valid request form contract.
   * @returns {Promise<void>}
   * @sideEffects Calls the create API, reloads data, closes the modal, and shows a toast.
   */
  async function createRequest(payload) {
    setWorkingId("create");
    setModalError("");

    try {
      const data = await groceryRequestService.createRequest(payload);
      await loadWorkspace();
      setRequestModalOpen(false);
      showToast(data.message, "success");
    } catch (requestError) {
      setModalError(normalizeApiError(requestError).message);
    } finally {
      setWorkingId("");
    }
  }

  /**
   * Records a local caregiver purchase and refreshes request state.
   * @param {object} payload - Purchase contract from the modal.
   * @returns {Promise<void>}
   * @sideEffects Calls the purchase API, reloads data, and shows feedback.
   */
  async function recordPurchase(payload) {
    if (!purchaseRequest) {
      return;
    }

    setWorkingId(purchaseRequest._id);
    setModalError("");

    try {
      const data = await groceryRequestService.recordPurchase(
        "caregiver",
        purchaseRequest._id,
        payload,
      );
      await loadWorkspace();
      setPurchaseRequest(null);
      showToast(data.message, "success");
    } catch (requestError) {
      setModalError(normalizeApiError(requestError).message);
    } finally {
      setWorkingId("");
    }
  }

  /**
   * Performs one allowed caregiver status transition.
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
        "caregiver",
        requestId,
        { status },
      );
      await loadWorkspace();
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
   * Uploads an optional PDF or image receipt selected from one request card.
   * @param {string} requestId - GroceryRequest identifier.
   * @param {import("react").ChangeEvent<HTMLInputElement>} event - File input event.
   * @returns {Promise<void>}
   * @sideEffects Uploads the file, clears the input, reloads data, and shows feedback.
   */
  async function uploadReceipt(requestId, event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setWorkingId(requestId);

    try {
      const data = await groceryRequestService.uploadReceipt(
        "caregiver",
        requestId,
        file,
      );
      await loadWorkspace();
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

  return (
    <main>
      <CaregiverHeader />
      <div className="caregiver-page grocery-page">
        <div className="page-heading page-heading--action grocery-page-heading">
          <div>
            <span className="eyebrow">Local care coordination</span>
            <h1>Groceries and essentials</h1>
            <p>
              Request needed items, follow family approval, and record a local
              purchase without requiring a cash memo.
            </p>
          </div>
          <Button
            disabled={!assignments.length}
            onClick={() => {
              setModalError("");
              setRequestModalOpen(true);
            }}
          >
            <PlusIcon size={18} />
            New request
          </Button>
        </div>
        {!loading && !assignments.length && (
          <div className="grocery-context-note">
            A scheduled, active, or completed care assignment is needed before
            an essentials request can be created.
          </div>
        )}
        <div className="grocery-view-tabs" role="group" aria-label="Request view">
          {[
            { value: "active", label: "Active" },
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
            <p>New and completed essentials requests will stay organized here.</p>
          </div>
        )}
        <div className="grocery-request-grid">
          {visibleRequests.map((request) => {
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
                actions={(
                  <>
                    {request.status === "submitted" && (
                      <Button
                        variant="ghost"
                        isLoading={workingId === request._id}
                        onClick={() => changeStatus(request._id, "cancelled")}
                      >
                        Cancel request
                      </Button>
                    )}
                    {request.status === "approved"
                      && request.fulfillmentMethod === "caregiver-purchase" && (
                        <Button
                          variant="secondary"
                          isLoading={workingId === request._id}
                          onClick={() => changeStatus(request._id, "purchasing")}
                        >
                          Start purchasing
                        </Button>
                      )}
                    {["approved", "purchasing"].includes(request.status)
                      && request.fulfillmentMethod === "caregiver-purchase" && (
                        <Button onClick={() => {
                          setModalError("");
                          setPurchaseRequest(request);
                        }}>
                          Record purchase
                        </Button>
                      )}
                    {["purchased", "out-for-delivery"].includes(request.status) && (
                      <Button
                        isLoading={workingId === request._id}
                        onClick={() => changeStatus(request._id, "delivered")}
                      >
                        Mark delivered
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
      <GroceryRequestModal
        isOpen={requestModalOpen}
        assignments={assignments}
        isSubmitting={workingId === "create"}
        error={modalError}
        onClose={() => setRequestModalOpen(false)}
        onSubmit={createRequest}
      />
      <GroceryPurchaseModal
        request={purchaseRequest}
        role="caregiver"
        isSubmitting={Boolean(purchaseRequest) && workingId === purchaseRequest._id}
        error={modalError}
        onClose={() => setPurchaseRequest(null)}
        onSubmit={recordPurchase}
      />
    </main>
  );
}
