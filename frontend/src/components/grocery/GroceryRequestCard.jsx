import { ClockIcon, MapPinIcon, MoneyIcon } from "../Icons.jsx";

/**
 * Formats a stored date for concise request history display.
 * @param {string|Date|null} value - Stored date value.
 * @returns {string} Local date text or Not set.
 * @sideEffects None.
 */
function formatDate(value) {
  if (!value) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(new Date(value));
}

/**
 * Converts a machine status into readable words.
 * @param {string} value - Stored workflow status.
 * @returns {string} Title-cased status label.
 * @sideEffects None.
 */
function formatStatus(value) {
  const words = value.split("-");
  const formattedWords = [];

  for (const word of words) {
    formattedWords.push(word.charAt(0).toUpperCase() + word.slice(1));
  }

  return formattedWords.join(" ");
}

/**
 * Chooses the clearest available BDT budget label for a request.
 * @param {object} request - Grocery request containing optional budget values.
 * @returns {string} Approved, estimated, or missing-budget text.
 * @sideEffects None.
 */
function formatBudget(request) {
  if (request.approvedBudget) {
    return "Approved BDT " + request.approvedBudget.toLocaleString();
  }

  if (request.estimatedBudget) {
    return "Estimated BDT " + request.estimatedBudget.toLocaleString();
  }

  return "Budget not estimated";
}

/**
 * Presents one essentials request and role-specific action controls.
 * @param {{request: object, actions?: import("react").ReactNode}} props - Grocery request and action area.
 * @returns {import("react").ReactElement} Request summary card.
 * @sideEffects None.
 */
export function GroceryRequestCard({ request, actions = null }) {
  let method = "Waiting for family decision";

  if (request.fulfillmentMethod === "caregiver-purchase") {
    method = "Caregiver will purchase locally";
  } else if (request.fulfillmentMethod === "family-remote-order") {
    method = "Family will arrange a remote order";
  }

  return (
    <article className={`grocery-request-card grocery-request-card--${request.status}`}>
      <header className="grocery-request-card__header">
        <div>
          <span className="grocery-request-card__eyebrow">
            {request.urgency === "urgent" ? "Urgent essentials" : "Essentials request"}
          </span>
          <h2>{request.elderly?.name || "Care recipient"}</h2>
          <p>Requested by {request.caregiver?.name || "assigned caregiver"}</p>
        </div>
        <span className={`status-badge grocery-status grocery-status--${request.status}`}>
          {formatStatus(request.status)}
        </span>
      </header>
      <div className="grocery-request-meta">
        <span>
          <ClockIcon size={16} />
          Needed by {formatDate(request.neededBy)}
        </span>
        <span>
          <MoneyIcon size={16} />
          {formatBudget(request)}
        </span>
        <span>
          <MapPinIcon size={16} />
          {method}
        </span>
      </div>
      <div className="grocery-item-list">
        {request.items.map((item) => (
          <div className="grocery-item-pill" key={item._id || item.name}>
            <strong>{item.name}</strong>
            <span>{item.quantity} {item.unit}</span>
            {item.notes && <small>{item.notes}</small>}
          </div>
        ))}
      </div>
      {(request.caregiverNote || request.familyDecisionNote) && (
        <div className="grocery-request-notes">
          {request.caregiverNote && (
            <p><strong>Caregiver:</strong> {request.caregiverNote}</p>
          )}
          {request.familyDecisionNote && (
            <p><strong>Family:</strong> {request.familyDecisionNote}</p>
          )}
        </div>
      )}
      {request.actualTotal !== null && (
        <div className="grocery-purchase-summary">
          <div>
            <span>Recorded total</span>
            <strong>BDT {request.actualTotal.toLocaleString()}</strong>
          </div>
          <div>
            <span>Payment record</span>
            <strong>{request.paymentSettled ? "Settled" : "Not marked settled"}</strong>
          </div>
          <div>
            <span>Shop</span>
            <strong>{request.selectedStore?.name || "Not recorded"}</strong>
          </div>
        </div>
      )}
      {request.receiptUrl && (
        <a
          className="grocery-receipt-link"
          href={request.receiptUrl}
          target="_blank"
          rel="noreferrer"
        >
          Open optional receipt
        </a>
      )}
      {actions && <footer className="grocery-request-actions">{actions}</footer>}
    </article>
  );
}
