import { useEffect, useState } from "react";
import { Button } from "../Button.jsx";
import { Modal } from "../Modal.jsx";
import { PlusIcon, TrashIcon } from "../Icons.jsx";

/**
 * Creates one blank item row for the caregiver request form.
 * @returns {{name: string, category: string, quantity: string, unit: string, notes: string}} Empty editable item.
 * @sideEffects None.
 */
function createBlankItem() {
  return {
    name: "",
    category: "grocery",
    quantity: "1",
    unit: "item",
    notes: "",
  };
}

/**
 * Collects one assignment-backed grocery or essentials request.
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
  const [careAssignmentId, setCareAssignmentId] = useState("");
  const [items, setItems] = useState([createBlankItem()]);
  const [urgency, setUrgency] = useState("normal");
  const [neededBy, setNeededBy] = useState("");
  const [estimatedBudget, setEstimatedBudget] = useState("");
  const [caregiverNote, setCaregiverNote] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const firstAssignmentId = assignments[0]?.id || "";
    setCareAssignmentId(firstAssignmentId);
    setItems([createBlankItem()]);
    setUrgency("normal");
    setNeededBy("");
    setEstimatedBudget("");
    setCaregiverNote("");
  }, [assignments, isOpen]);

  /**
   * Replaces one field in one item without mutating the existing array.
   * @param {number} index - Item row index.
   * @param {string} field - Item property name.
   * @param {string} value - New form value.
   * @returns {void}
   * @sideEffects Updates local item state.
   */
  function updateItem(index, field, value) {
    const nextItems = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      if (itemIndex === index) {
        nextItems.push({
          ...items[itemIndex],
          [field]: value,
        });
      } else {
        nextItems.push(items[itemIndex]);
      }
    }

    setItems(nextItems);
  }

  /**
   * Adds another editable item row up to the backend limit.
   * @returns {void}
   * @sideEffects Updates local item state.
   */
  function addItem() {
    if (items.length < 30) {
      setItems([...items, createBlankItem()]);
    }
  }

  /**
   * Removes one item while keeping at least one row.
   * @param {number} index - Row index to remove.
   * @returns {void}
   * @sideEffects Updates local item state.
   */
  function removeItem(index) {
    if (items.length === 1) {
      return;
    }

    const nextItems = [];

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      if (itemIndex !== index) {
        nextItems.push(items[itemIndex]);
      }
    }

    setItems(nextItems);
  }

  /**
   * Builds the shared request contract and submits it.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Form submission event.
   * @returns {Promise<void>}
   * @sideEffects Calls the supplied asynchronous submit handler.
   */
  async function handleSubmit(event) {
    event.preventDefault();
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
        ...item,
        quantity: Number(item.quantity),
      });
    }

    const payload = {
      careAssignmentId,
      elderlyProfileId: assignment.elderlyProfileId,
      items: normalizedItems,
      urgency,
      neededBy: neededBy || null,
      estimatedBudget: estimatedBudget || null,
      caregiverNote,
    };
    await onSubmit(payload);
  }

  return (
    <Modal
      isOpen={isOpen}
      title="Request groceries or essentials"
      className="grocery-modal"
      onClose={onClose}
    >
      <form className="grocery-form" onSubmit={handleSubmit}>
        <p className="modal-intro">
          Add only items needed for an assigned elderly person. The linked
          family will choose the budget and purchase method.
        </p>
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
        <div className="grocery-item-heading">
          <div>
            <h3>Requested items</h3>
            <p>Use simple units such as kg, packet, strip, bottle, or item.</p>
          </div>
          <Button type="button" variant="secondary" onClick={addItem}>
            <PlusIcon size={17} />
            Add item
          </Button>
        </div>
        <div className="grocery-item-editor">
          {items.map((item, index) => (
            <fieldset className="grocery-item-row" key={index}>
              <legend>Item {index + 1}</legend>
              <label className="field grocery-item-row__name">
                <span>Name</span>
                <input
                  className="input"
                  required
                  maxLength={120}
                  value={item.name}
                  onChange={(event) => updateItem(index, "name", event.target.value)}
                  placeholder="Rice, soap, medicine..."
                />
              </label>
              <label className="field">
                <span>Category</span>
                <select
                  className="input"
                  value={item.category}
                  onChange={(event) => updateItem(index, "category", event.target.value)}
                >
                  <option value="grocery">Grocery</option>
                  <option value="household">Household</option>
                  <option value="personal-care">Personal care</option>
                  <option value="pharmacy">Pharmacy</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="field">
                <span>Quantity</span>
                <input
                  className="input"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  value={item.quantity}
                  onChange={(event) => updateItem(index, "quantity", event.target.value)}
                />
              </label>
              <label className="field">
                <span>Unit</span>
                <input
                  className="input"
                  required
                  maxLength={30}
                  value={item.unit}
                  onChange={(event) => updateItem(index, "unit", event.target.value)}
                />
              </label>
              <label className="field grocery-item-row__notes">
                <span>Item note (optional)</span>
                <input
                  className="input"
                  maxLength={300}
                  value={item.notes}
                  onChange={(event) => updateItem(index, "notes", event.target.value)}
                />
              </label>
              <button
                type="button"
                className="icon-button grocery-remove-item"
                aria-label={`Remove item ${index + 1}`}
                disabled={items.length === 1}
                onClick={() => removeItem(index)}
              >
                <TrashIcon size={17} />
              </button>
            </fieldset>
          ))}
        </div>
        <div className="form-grid form-grid--two">
          <label className="field">
            <span>Urgency</span>
            <select
              className="input"
              value={urgency}
              onChange={(event) => setUrgency(event.target.value)}
            >
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
            </select>
          </label>
          <label className="field">
            <span>Needed by (optional)</span>
            <input
              className="input"
              type="date"
              value={neededBy}
              onChange={(event) => setNeededBy(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Estimated budget in BDT (optional)</span>
            <input
              className="input"
              type="number"
              min="0"
              step="1"
              value={estimatedBudget}
              onChange={(event) => setEstimatedBudget(event.target.value)}
            />
          </label>
          <label className="field">
            <span>Caregiver note (optional)</span>
            <textarea
              className="input"
              maxLength={1000}
              value={caregiverNote}
              onChange={(event) => setCaregiverNote(event.target.value)}
            />
          </label>
        </div>
        {error && <div className="alert alert--error">{error}</div>}
        <div className="modal__actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} disabled={!assignments.length}>
            Send for approval
          </Button>
        </div>
      </form>
    </Modal>
  );
}
