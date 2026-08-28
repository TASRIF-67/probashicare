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
  let dismissalIsActive = false;

  if (reminder?.dismissedUntil) {
    // `getTime` converts the stored date to milliseconds. `Date.now` returns
    // the current time in the same unit, so the values can be compared.
    const dismissalEnd = new Date(reminder.dismissedUntil).getTime();
    dismissalIsActive = dismissalEnd > Date.now();
  }

  // `Boolean` converts an object/null value into an explicit true/false flag.
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
