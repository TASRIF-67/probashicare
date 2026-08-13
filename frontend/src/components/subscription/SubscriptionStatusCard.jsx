import { Link } from "react-router-dom";
import { Card } from "../Card.jsx";
import { ArrowRightIcon, ShieldCheckIcon } from "../Icons.jsx";

/**
 * Displays compact Family subscription access.
 * @param {{state: object|null, loading?: boolean}} props - Loaded subscription state.
 * @returns {import("react").ReactElement} Dashboard subscription card.
 * @sideEffects None.
 */
export function SubscriptionStatusCard({ state, loading = false }) {
  const access = state?.access;
  const subscription = state?.subscription;
  let title = "Core access";
  let detail = "Explore the free trial and Premium plans.";

  if (access?.isPremium) {
    title =
      subscription?.status === "trialing"
        ? "Free trial active"
        : (subscription?.planSnapshot?.name || "Premium") + " active";
    detail =
      "Available until " +
      new Date(access.expiresAt).toLocaleString();
  } else if (subscription?.status === "expired") {
    title = "Subscription expired";
    detail = "Stored care information remains available.";
  }

  return (
    <Card className="subscription-status-card">
      <span className="feature-icon">
        <ShieldCheckIcon />
      </span>
      <div>
        <span className="eyebrow">Family access</span>
        <h2>{loading ? "Checking subscription" : title}</h2>
        <p>{loading ? "Loading current access." : detail}</p>
      </div>
      <Link className="button button--secondary" to="/subscription">
        View plans
        <ArrowRightIcon size={17} />
      </Link>
    </Card>
  );
}
