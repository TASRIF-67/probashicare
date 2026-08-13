import { Link } from "react-router-dom";
import { Button } from "../Button.jsx";
import { Modal } from "../Modal.jsx";

/**
 * Displays one controlled renewal reminder on the Family dashboard.
 * @param {{reminder: object|null, onDismiss: Function, isDismissing?: boolean}} props - Reminder state and persisted dismissal action.
 * @returns {import("react").ReactElement} Renewal reminder modal.
 * @sideEffects Calls the dismissal handler or navigates to subscription plans.
 */
export function SubscriptionExpiryModal({
  reminder,
  onDismiss,
  isDismissing = false,
}) {
  const dismissalIsActive =
    reminder?.dismissedUntil &&
    new Date(reminder.dismissedUntil).getTime() > Date.now();
  const isOpen = Boolean(reminder) && !dismissalIsActive;

  return (
    <Modal
      isOpen={isOpen}
      title={reminder?.title || "Premium access reminder"}
      onClose={onDismiss}
    >
      <div className="subscription-modal-content">
        <p>{reminder?.message}</p>
        <p>
          Existing bookings and stored care information remain available after
          expiry. New Premium actions will require renewal.
        </p>
        <div className="modal-actions">
          <Button
            type="button"
            variant="secondary"
            isLoading={isDismissing}
            onClick={onDismiss}
          >
            Remind me later
          </Button>
          <Link className="button button--primary" to="/subscription">
            View plans
          </Link>
        </div>
      </div>
    </Modal>
  );
}
