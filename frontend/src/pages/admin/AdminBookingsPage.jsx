import { AdminBookingHistory } from "../../components/admin/AdminBookingHistory.jsx";

/**
 * Provides the dedicated administrator workspace for booking audit history.
 * @returns {import("react").ReactElement} Filterable family-to-caregiver booking history.
 * @sideEffects The history component loads protected booking data from the Admin API.
 */
export function AdminBookingsPage() {
  return <AdminBookingHistory />;
}
