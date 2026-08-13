import { useEffect, useState } from "react";
import { Card } from "../../components/Card.jsx";
import { MoneyIcon, SearchIcon } from "../../components/Icons.jsx";
import { Pagination } from "../../components/Pagination.jsx";
import { adminService } from "../../services/adminService.js";
import { normalizeApiError } from "../../services/api.js";

const STATUS_OPTIONS = ["all", "pending", "completed", "failed", "cancelled", "refunded"];

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

  return new Date(value).toLocaleString();
}

/**
 * Displays all simulated subscription transactions to an administrator.
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

  useEffect(() => {
    let isActive = true;

    /**
     * Loads transactions for the currently selected filters.
     * @returns {Promise<void>}
     * @sideEffects Calls the Admin API and updates page state.
     */
    async function loadPayments() {
      setState((current) => ({
        ...current,
        loading: true,
        error: "",
      }));

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
          setState({
            loading: false,
            payments: [],
            pagination: null,
            error: normalizeApiError(error).message,
          });
        }
      }
    }

    loadPayments();

    return () => {
      isActive = false;
    };
  }, [page, search, status]);

  /**
   * Applies the entered transaction ID search.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Search form submission.
   * @returns {void}
   * @sideEffects Prevents navigation and updates the applied search filter.
   */
  function submitSearch(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <>
      <div className="admin-heading">
        <div>
          <span className="eyebrow">Business reporting</span>
          <h1>Subscription transactions</h1>
          <p>Audit every simulated payment attempt and its final status.</p>
        </div>
        <span className="status-badge">Simulation only</span>
      </div>

      <Card className="admin-payment-filters">
        <label className="field">
          <span>Payment status</span>
          <select
            className="input"
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
          >
            {STATUS_OPTIONS.map((option) => (
              <option value={option} key={option}>
                {option}
              </option>
            ))}
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
                placeholder="DEV-..."
                onChange={(event) => {
                  setSearchInput(event.target.value);
                }}
              />
            </div>
          </label>
        </form>
      </Card>

      {state.error && <div className="alert alert--error">{state.error}</div>}
      {state.loading && <div className="page-loader-inline"><span className="spinner" /> Loading transactions</div>}

      {!state.loading && !state.payments.length && (
        <Card className="overview-empty">
          <MoneyIcon />
          <strong>No matching transactions</strong>
          <span>New simulated payment attempts will appear here.</span>
        </Card>
      )}

      <div className="admin-payment-list">
        {state.payments.map((payment) => (
          <Card className="admin-payment-row" key={payment._id}>
            <div>
              <strong>{payment.transactionReference}</strong>
              <small>{payment.confirmationReference || "No completion confirmation"}</small>
            </div>
            <div>
              <strong>{payment.family?.name || "Deleted family account"}</strong>
              <small>{payment.family?.email || "Email unavailable"}</small>
            </div>
            <div>
              <strong>{payment.planSnapshot.name}</strong>
              <small>{payment.paymentMethod.replaceAll("_", " ")}</small>
            </div>
            <strong>BDT {payment.amount.toLocaleString()}</strong>
            <span className={"status-badge status-badge--" + payment.status}>
              {payment.status}
            </span>
            <time>{formatDateTime(payment.completedAt || payment.createdAt)}</time>
          </Card>
        ))}
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
            Showing {state.payments.length} transaction{state.payments.length === 1 ? "" : "s"} on this page.
          </p>
        </>
      )}
    </>
  );
}
