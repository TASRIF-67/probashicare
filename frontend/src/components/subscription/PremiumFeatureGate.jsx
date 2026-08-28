import { Link } from "react-router-dom";
import { Modal } from "../Modal.jsx";

/**
 * Explains a locked Premium action without replacing backend authorization.
 * @param {{isOpen: boolean, onClose: () => void, featureName?: string}} props - Modal state.
 * @returns {import("react").ReactElement} Upgrade dialog.
 * @sideEffects Navigates through React Router when View plans is selected.
 */
export function PremiumFeatureGate({
  isOpen,
  onClose,
  featureName = "This action",
}) {
  return (
    <Modal isOpen={isOpen} title="Premium access required" onClose={onClose}>
      <div className="subscription-modal-content">
        <p>
          {featureName} requires an active free trial or paid Premium plan.
          Existing bookings and care history remain available.
        </p>
        <div className="modal-actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={onClose}
          >
            Not now
          </button>
          <Link className="button button--primary" to="/subscription">
            View plans
          </Link>
        </div>
      </div>
    </Modal>
  );
}
