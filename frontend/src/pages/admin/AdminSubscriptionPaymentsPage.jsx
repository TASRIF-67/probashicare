import { useEffect, useState } from "react";
import { Card } from "../../components/Card.jsx";
import { MoneyIcon, SearchIcon } from "../../components/Icons.jsx";
import { Pagination } from "../../components/Pagination.jsx";
import { adminService } from "../../services/adminService.js";
import { normalizeApiError } from "../../services/api.js";

const STATUS_OPTIONS = [
  "all",
  "pending",
  "completed",
  "failed",
  "cancelled",
  "refunded",
];

/**
 * Formats a transaction timestamp for admin display.
 * @param {string|Date|null} value - Stored payment timestamp.
 * @returns {string} Local date and time or Not available.
 * @sideEffects None.
 */
function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString();
}

/**
 * Converts a stored method name into readable words.
 * @param {string} value - Internal payment method.
 * @returns {string} Human-readable payment method.
 * @sideEffects None.
 */
function formatPaymentMethod(value) {
  // `split` creates words around underscores and `join` reconnects them.
  return String(value || "")
    .split("_")
    .join(" ");
}

/**
 * Adds a plural suffix when a count is not exactly one.
 * @param {number} count - Number of records.
 * @param {string} singular - Singular noun.
 * @returns {string} Correct singular or plural label.
 * @sideEffects None.
 */
function pluralize(count, singular) {
  if (count === 1) {
    return singular;
  }

  return singular + "s";
}

/**
 * Displays one Admin-visible subscription payment.
 * @param {{payment: object}} props - Populated payment record.
 * @returns {import("react").ReactElement} Transaction row.
 * @sideEffects None.
 */
function AdminPaymentRow({ payment }) {
  const familyName = payment.family?.name || "Deleted family account";
  const familyEmail = payment.family?.email || "Email unavailable";
  const confirmation =
    payment.confirmationReference || "No completion confirmation";
  const displayedTime = payment.completedAt || payment.createdAt;

  return (
    <Card className="admin-payment-row">
      <div>
        <strong>{payment.transactionReference}</strong>
        <small>{confirmation}</small>
      </div>
      <div>
        <strong>{familyName}</strong>
        <small>{familyEmail}</small>
      </div>
      <div>
        <strong>{payment.planSnapshot.name}</strong>
        <small>{formatPaymentMethod(payment.paymentMethod)}</small>
      </div>
      <strong>BDT {payment.amount.toLocaleString()}</strong>
      <span className={"status-badge status-badge--" + payment.status}>
        {payment.status}
      </span>
      <time>{formatDateTime(displayedTime)}</time>
    </Card>
  );
}

/**
 * Displays all subscription transactions to an administrator.
 * @returns {import("react").ReactElement} Filterable transaction history page.
 * @sideEffects Loads Admin-only transaction data when filters change.
 */
export function AdminSubscriptionPaymentsPage() {
  const [status, setStatus] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [state, setState] = useState({
    loading: true,
    payments: [],
    pagination: null,
    error: "",
  });

  useEffect(
    /**
     * Loads a new transaction page whenever an applied filter changes.
     * @returns {() => void} Cleanup that blocks late state updates.
     * @sideEffects Calls the Admin transaction API.
     */
    function loadPaymentsWhenFiltersChange() {
      let isActive = true;

      /**
       * Loads transactions for the currently selected filters.
       * @returns {Promise<void>}
       * @sideEffects Calls the Admin API and updates page state.
       */
      async function loadPayments() {
        setState(
          /**
           * Preserves current records while a filtered page is loading.
           * @param {object} currentState - Existing transaction state.
           * @returns {object} Loading transaction state.
           * @sideEffects None.
           */
          function beginPaymentLoad(currentState) {
            return {
              ...currentState,
              loading: true,
              error: "",
            };
          },
        );

        try {
          const data = await adminService.listSubscriptionPayments({
            status,
            search,
            page,
            limit: 3,
          });

          if (isActive) {
            setState({
              loading: false,
              payments: data.payments,
              pagination: data.pagination,
              error: "",
            });
          }
        } catch (error) {
          if (isActive) {
            const normalizedError = normalizeApiError(error);

            setState({
              loading: false,
              payments: [],
              pagination: null,
              error: normalizedError.message,
            });
          }
        }
      }

      void loadPayments();

      /**
       * Prevents a completed request from updating an unmounted page.
       * @returns {void}
       * @sideEffects Changes the effect-local activity flag.
       */
      return function stopPaymentStateUpdates() {
        isActive = false;
      };
    },
    [page, search, status],
  );

  /**
   * Applies the entered transaction ID search.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Form event.
   * @returns {void}
   * @sideEffects Prevents navigation and updates the search filter.
   */
  function submitSearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  /**
   * Applies a selected payment status and returns to page one.
   * @param {import("react").ChangeEvent<HTMLSelectElement>} event - Change event.
   * @returns {void}
   * @sideEffects Updates status and pagination state.
   */
  function changeStatus(event) {
    setPage(1);
    setStatus(event.target.value);
  }

  /**
   * Stores transaction search input without requesting immediately.
   * @param {import("react").ChangeEvent<HTMLInputElement>} event - Input event.
   * @returns {void}
   * @sideEffects Updates controlled input state.
   */
  function changeSearchInput(event) {
    setSearchInput(event.target.value);
  }

  const recordsOnPage = state.payments.length;
  const recordLabel = pluralize(recordsOnPage, "transaction");

  return (
    <>
      <div className="admin-heading">
        <div>
          <span className="eyebrow">Business reporting</span>
          <h1>Subscription transactions</h1>
          <p>Audit every payment attempt and its final status.</p>
        </div>
        <span className="status-badge">Development payments</span>
      </div>

      <Card className="admin-payment-filters">
        <label className="field">
          <span>Payment status</span>
          <select className="input" value={status} onChange={changeStatus}>
            {STATUS_OPTIONS.map(
              /**
               * Converts one allowed status into a select option.
               * @param {string} option - Allowed status.
               * @returns {import("react").ReactElement} Status option.
               * @sideEffects None.
               */
              function renderStatusOption(option) {
                return (
                  <option value={option} key={option}>
                    {option}
                  </option>
                );
              },
            )}
          </select>
        </label>

        <form onSubmit={submitSearch}>
          <label className="field">
            <span>Transaction ID</span>
            <div className="input-with-icon">
              <SearchIcon size={17} />
              <input
                className="input"
                value={searchInput}
                placeholder="DEV-... or STRIPE-..."
                onChange={changeSearchInput}
              />
            </div>
          </label>
        </form>
      </Card>

      {state.error && <div className="alert alert--error">{state.error}</div>}

      {state.loading && (
        <div className="page-loader-inline">
          <span className="spinner" />
          Loading transactions
        </div>
      )}

      {!state.loading && state.payments.length === 0 && (
        <Card className="overview-empty">
          <MoneyIcon />
          <strong>No matching transactions</strong>
          <span>New payment attempts will appear here.</span>
        </Card>
      )}

      <div className="admin-payment-list">
        {state.payments.map(
          /**
           * Converts one populated payment into an Admin row.
           * @param {object} payment - Admin-visible payment.
           * @returns {import("react").ReactElement} Transaction row.
           * @sideEffects None.
           */
          function renderAdminPayment(payment) {
            return <AdminPaymentRow key={payment._id} payment={payment} />;
          },
        )}
      </div>

      {state.pagination && (
        <>
          <Pagination
            page={state.pagination.page}
            pages={state.pagination.pages}
            total={state.pagination.total}
            label="transactions"
            disabled={state.loading}
            onPageChange={setPage}
          />
          <p className="admin-payment-total">
            Showing {recordsOnPage} {recordLabel} on this page.
          </p>
        </>
      )}
    </>
  );
}
