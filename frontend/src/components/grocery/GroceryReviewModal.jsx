import { useEffect, useState } from "react";
import { Button } from "../Button.jsx";
import { Modal } from "../Modal.jsx";

/**
 * Collects a family approval method and BDT budget or a rejection reason.
 * @param {{request: object|null, isSubmitting: boolean, error: string, onClose: () => void, onSubmit: (payload: object) => Promise<void>}} props - Request and review handlers.
 * @returns {import("react").ReactElement|null} Family review dialog.
 * @sideEffects Resets review fields when the selected request changes.
 */
export function GroceryReviewModal({
  request,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}) {
  const [decision, setDecision] = useState("approve");
  const [fulfillmentMethod, setFulfillmentMethod] = useState("caregiver-purchase");
  const [approvedBudget, setApprovedBudget] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!request) {
      return;
    }

    setDecision("approve");
    setFulfillmentMethod("caregiver-purchase");
    setApprovedBudget(request.estimatedBudget || "");
    setNote("");
  }, [request]);

  /**
   * Sends one explicit family decision using the shared request contract.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Form submission event.
   * @returns {Promise<void>}
   * @sideEffects Calls the supplied asynchronous submit handler.
   */
  async function handleSubmit(event) {
    event.preventDefault();
    const payload = {
      decision,
      note,
    };

    if (decision === "approve") {
      payload.fulfillmentMethod = fulfillmentMethod;
      payload.approvedBudget = Number(approvedBudget);
    }

    await onSubmit(payload);
  }

  return (
    <Modal
      isOpen={Boolean(request)}
      title="Review essentials request"
      className="grocery-modal grocery-modal--compact"
      onClose={onClose}
    >
      {request && (
        <form className="grocery-form" onSubmit={handleSubmit}>
          <div className="grocery-review-summary">
            <strong>{request.elderly?.name}</strong>
            <span>{request.items.length} requested item(s)</span>
          </div>
          <label className="field">
            <span>Decision</span>
            <select
              className="input"
              value={decision}
              onChange={(event) => setDecision(event.target.value)}
            >
              <option value="approve">Approve request</option>
              <option value="reject">Reject request</option>
            </select>
          </label>
          {decision === "approve" && (
            <>
              <label className="field">
                <span>Who will arrange the items?</span>
                <select
                  className="input"
                  value={fulfillmentMethod}
                  onChange={(event) => setFulfillmentMethod(event.target.value)}
                >
                  <option value="caregiver-purchase">Caregiver purchases locally</option>
                  <option value="family-remote-order">Family arranges a remote order</option>
                </select>
              </label>
              <label className="field">
                <span>Approved maximum budget in BDT</span>
                <input
                  className="input"
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={approvedBudget}
                  onChange={(event) => setApprovedBudget(event.target.value)}
                />
              </label>
            </>
          )}
          <label className="field">
            <span>{decision === "reject" ? "Rejection reason" : "Decision note (optional)"}</span>
            <textarea
              className="input"
              required={decision === "reject"}
              minLength={decision === "reject" ? 5 : undefined}
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>
          {error && <div className="alert alert--error">{error}</div>}
          <div className="modal__actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Save decision
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
