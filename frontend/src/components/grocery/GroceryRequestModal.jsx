import { useEffect, useState } from "react";
import { Button } from "../Button.jsx";
import { Modal } from "../Modal.jsx";
import { GroceryCatalog } from "./GroceryCatalog.jsx";

/**
 * Collects one assignment-backed grocery or essentials request.
 * @param {{assignments: object[], isSubmitting: boolean, error: string, resetKey?: string|boolean, onCancel?: () => void, onSubmit: (payload: object) => Promise<void>}} props - Form data and handlers.
 * @returns {import("react").ReactElement} Caregiver request form.
 * @sideEffects Resets form state when resetKey changes and calls the supplied submit handler.
 */
export function GroceryRequestForm({
  assignments,
  isSubmitting,
  error,
  resetKey = "grocery-request",
  onCancel,
  onSubmit,
}) {
  const [careAssignmentId, setCareAssignmentId] = useState("");
  const [items, setItems] = useState([]);
  const [itemError, setItemError] = useState("");
  const [urgency, setUrgency] = useState("normal");
  const [neededBy, setNeededBy] = useState("");
  const [caregiverNote, setCaregiverNote] = useState("");
  const [isNoteOpen, setIsNoteOpen] = useState(false);

  useEffect(() => {
    if (!resetKey) {
      return;
    }

    const firstAssignmentId = assignments[0]?.id || "";
    setCareAssignmentId(firstAssignmentId);
    setItems([]);
    setItemError("");
    setUrgency("normal");
    setNeededBy("");
    setCaregiverNote("");
    setIsNoteOpen(false);
  }, [assignments, resetKey]);

  /**
   * Stores cart changes and clears an earlier empty-cart warning.
   * @param {object[]} nextItems - Complete next request cart.
   * @returns {void}
   * @sideEffects Updates item and validation state.
   */
  function handleItemsChange(nextItems) {
    setItems(nextItems);
    setItemError("");
  }

  /**
   * Builds the shared request contract and submits it.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Form submission event.
   * @returns {Promise<void>}
   * @sideEffects Calls the supplied asynchronous submit handler.
   */
  async function handleSubmit(event) {
    event.preventDefault();

    if (items.length === 0) {
      setItemError("Add at least one item to the request cart.");
      return;
    }

    let assignment = null;

    for (const candidate of assignments) {
      if (candidate.id === careAssignmentId) {
        assignment = candidate;
        break;
      }
    }

    if (!assignment) {
      return;
    }

    const normalizedItems = [];

    for (const item of items) {
      normalizedItems.push({
        name: item.name,
        category: item.category,
        quantity: Number(item.quantity),
        unit: item.unit,
        notes: item.notes,
      });
    }

    const payload = {
      careAssignmentId,
      elderlyProfileId: assignment.elderlyProfileId,
      items: normalizedItems,
      urgency,
      neededBy: urgency === "urgent" ? neededBy || null : null,
      estimatedBudget: null,
      caregiverNote,
    };
    await onSubmit(payload);
  }

  return (
      <form className="grocery-form grocery-request-form" onSubmit={handleSubmit}>
        <p className="modal-intro">
          Add only items needed for an assigned elderly person. The linked
          family will choose the budget and purchase method.
        </p>
        {assignments.length === 1 ? (
          <div className="grocery-recipient-summary">
            <span>Request for</span>
            <strong>{assignments[0].elderly.name}</strong>
          </div>
        ) : (
          <label className="field">
            <span>Care recipient</span>
            <select
              className="input"
              required
              value={careAssignmentId}
              onChange={(event) => setCareAssignmentId(event.target.value)}
            >
              {assignments.map((assignment) => (
                <option value={assignment.id} key={assignment.id}>
                  {assignment.elderly.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <GroceryCatalog
          items={items}
          error={itemError}
          onChange={handleItemsChange}
        />
        <section className="grocery-request-options" aria-label="Request timing">
          <label className="grocery-urgent-toggle">
            <input
              type="checkbox"
              checked={urgency === "urgent"}
              onChange={(event) => {
                setUrgency(event.target.checked ? "urgent" : "normal");
              }}
            />
            <span>
              <strong>Mark as urgent</strong>
              <small>Use only when these items are needed quickly.</small>
            </span>
          </label>
          {urgency === "urgent" && (
            <label className="field">
              <span>Needed by</span>
            <input
              className="input"
              type="date"
              value={neededBy}
              onChange={(event) => setNeededBy(event.target.value)}
            />
            </label>
          )}
        </section>
        <button
          type="button"
          className="grocery-add-note-button"
          aria-expanded={isNoteOpen}
          onClick={() => {
            setIsNoteOpen(!isNoteOpen);
          }}
        >
          {isNoteOpen ? "Remove request note" : "Add a request note"}
        </button>
        {isNoteOpen && (
          <label className="field">
            <span>Request note</span>
            <textarea
              className="input"
              maxLength={1000}
              value={caregiverNote}
              placeholder="Only add information the family needs to know."
              onChange={(event) => setCaregiverNote(event.target.value)}
            />
          </label>
        )}
        {error && <div className="alert alert--error">{error}</div>}
        <div className="modal__actions grocery-request-form__actions">
          {onCancel && (
            <Button type="button" variant="secondary" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" isLoading={isSubmitting} disabled={!assignments.length}>
            Send for approval
          </Button>
        </div>
      </form>
  );
}

/**
 * Displays the grocery request form inside a dialog for legacy callers.
 * @param {{isOpen: boolean, assignments: object[], isSubmitting: boolean, error: string, onClose: () => void, onSubmit: (payload: object) => Promise<void>}} props - Dialog data and handlers.
 * @returns {import("react").ReactElement|null} Caregiver request dialog.
 * @sideEffects Resets form state on open and calls the supplied submit handler.
 */
export function GroceryRequestModal({
  isOpen,
  assignments,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}) {
  return (
    <Modal
      isOpen={isOpen}
      title="Request groceries or essentials"
      className="grocery-modal"
      onClose={onClose}
    >
      <GroceryRequestForm
        assignments={assignments}
        isSubmitting={isSubmitting}
        error={error}
        resetKey={isOpen}
        onCancel={onClose}
        onSubmit={onSubmit}
      />
    </Modal>
  );
}
