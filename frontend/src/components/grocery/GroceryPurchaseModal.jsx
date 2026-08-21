import { useEffect, useState } from "react";
import { Button } from "../Button.jsx";
import { Modal } from "../Modal.jsx";
import { StoreLocator } from "./StoreLocator.jsx";

/**
 * Creates an empty manual store snapshot accepted by the backend contract.
 * @returns {{source: string, externalId: string, name: string, category: string, address: string, phone: string, latitude: null, longitude: null}} Empty store record.
 * @sideEffects None.
 */
function createManualStore() {
  return {
    source: "manual",
    externalId: "",
    name: "",
    category: "local shop",
    address: "",
    phone: "",
    latitude: null,
    longitude: null,
  };
}

/**
 * Collects local-purchase or family remote-order details and an optional store.
 * @param {{request: object|null, role: "family"|"caregiver", isSubmitting: boolean, error: string, onClose: () => void, onSubmit: (payload: object) => Promise<void>}} props - Workflow state and handlers.
 * @returns {import("react").ReactElement|null} Purchase/order dialog.
 * @sideEffects Resets local form fields and calls the supplied submit handler.
 */
export function GroceryPurchaseModal({
  request,
  role,
  isSubmitting,
  error,
  onClose,
  onSubmit,
}) {
  const [actualTotal, setActualTotal] = useState("");
  const [paymentArrangement, setPaymentArrangement] = useState("");
  const [externalOrderReference, setExternalOrderReference] = useState("");
  const [purchaseNote, setPurchaseNote] = useState("");
  const [storeMode, setStoreMode] = useState("manual");
  const [selectedStore, setSelectedStore] = useState(null);
  const [manualStore, setManualStore] = useState(createManualStore());

  useEffect(() => {
    if (!request) {
      return;
    }

    let defaultArrangement = "caregiver-paid-reimbursement-pending";

    if (role === "family") {
      defaultArrangement = "family-paid-store-directly";
    }

    setActualTotal("");
    setPaymentArrangement(defaultArrangement);
    setExternalOrderReference("");
    setPurchaseNote("");
    setStoreMode("manual");
    setSelectedStore(null);
    setManualStore(createManualStore());
  }, [request, role]);

  /**
   * Replaces one manual store field without mutating prior state.
   * @param {string} field - Store field name.
   * @param {string} value - New field value.
   * @returns {void}
   * @sideEffects Updates local manual-store state.
   */
  function updateManualStore(field, value) {
    setManualStore((current) => {
      return {
        ...current,
        [field]: value,
      };
    });
  }

  /**
   * Builds and sends the shared purchase contract.
   * @param {import("react").FormEvent<HTMLFormElement>} event - Form event.
   * @returns {Promise<void>}
   * @sideEffects Calls the supplied asynchronous purchase handler.
   */
  async function handleSubmit(event) {
    event.preventDefault();
    let store = selectedStore;

    if (storeMode === "manual") {
      store = manualStore.name ? manualStore : null;
    }

    await onSubmit({
      actualTotal: Number(actualTotal),
      paymentArrangement,
      externalOrderReference,
      purchaseNote,
      selectedStore: store,
    });
  }

  let title = "Record local purchase";

  if (role === "family") {
    title = "Record remote order";
  }

  return (
    <Modal
      isOpen={Boolean(request)}
      title={title}
      className="grocery-modal grocery-modal--wide"
      onClose={onClose}
    >
      {request && (
        <form className="grocery-form" onSubmit={handleSubmit}>
          <div className="grocery-payment-context">
            <div>
              <span>Approved budget</span>
              <strong>BDT {request.approvedBudget?.toLocaleString()}</strong>
            </div>
            <p>
              ProbashiCare records the arrangement only. Money is paid or
              reimbursed outside the platform.
            </p>
          </div>
          <div className="form-grid form-grid--two">
            <label className="field">
              <span>Actual total in BDT</span>
              <input
                className="input"
                type="number"
                min="1"
                step="0.01"
                required
                value={actualTotal}
                onChange={(event) => setActualTotal(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Payment arrangement</span>
              <select
                className="input"
                required
                value={paymentArrangement}
                onChange={(event) => setPaymentArrangement(event.target.value)}
              >
                <option value="caregiver-paid-reimbursement-pending">Caregiver paid, reimbursement pending</option>
                <option value="family-transferred-beforehand">Family transferred money beforehand</option>
                <option value="cash-on-delivery">Cash on delivery</option>
                <option value="family-paid-store-directly">Family paid the store directly</option>
                <option value="settled-outside-probashicare">Settled outside ProbashiCare</option>
              </select>
            </label>
            <label className="field">
              <span>Order or reference number (optional)</span>
              <input
                className="input"
                maxLength={160}
                value={externalOrderReference}
                onChange={(event) => setExternalOrderReference(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Purchase note (optional)</span>
              <textarea
                className="input"
                maxLength={1000}
                value={purchaseNote}
                onChange={(event) => setPurchaseNote(event.target.value)}
              />
            </label>
          </div>
          <div className="grocery-store-choice" role="group" aria-label="Store entry method">
            <button
              type="button"
              className={storeMode === "manual" ? "is-active" : ""}
              aria-pressed={storeMode === "manual"}
              onClick={() => setStoreMode("manual")}
            >
              Enter a local shop
            </button>
            <button
              type="button"
              className={storeMode === "map" ? "is-active" : ""}
              aria-pressed={storeMode === "map"}
              onClick={() => setStoreMode("map")}
            >
              Find on map
            </button>
          </div>
          {storeMode === "manual" && (
            <div className="form-grid form-grid--two grocery-manual-store">
              <label className="field">
                <span>Shop name (optional)</span>
                <input
                  className="input"
                  maxLength={160}
                  value={manualStore.name}
                  onChange={(event) => updateManualStore("name", event.target.value)}
                  placeholder="Local shop or pharmacy name"
                />
              </label>
              <label className="field">
                <span>Area or address (optional)</span>
                <input
                  className="input"
                  maxLength={400}
                  value={manualStore.address}
                  onChange={(event) => updateManualStore("address", event.target.value)}
                />
              </label>
            </div>
          )}
          {storeMode === "map" && (
            <StoreLocator
              selectedStore={selectedStore}
              onSelect={setSelectedStore}
            />
          )}
          {selectedStore && storeMode === "map" && (
            <div className="grocery-selected-store">
              <span>Selected mapped store</span>
              <strong>{selectedStore.name}</strong>
              <small>{selectedStore.address || selectedStore.category}</small>
            </div>
          )}
          <p className="field-hint">
            Cash memo or receipt is optional and can be uploaded after saving.
          </p>
          {error && <div className="alert alert--error">{error}</div>}
          <div className="modal__actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Save details
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
