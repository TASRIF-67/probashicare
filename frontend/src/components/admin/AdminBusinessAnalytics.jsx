import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../Card.jsx";
import { ClockIcon, MoneyIcon, ShieldCheckIcon } from "../Icons.jsx";
import { adminService } from "../../services/adminService.js";
import { normalizeApiError } from "../../services/api.js";

/**
 * Formats a simulated business amount in Bangladeshi Taka.
 * @param {number} amount - Stored payment amount.
 * @returns {string} Readable BDT amount.
 * @sideEffects None.
 */
function formatMoney(amount) {
  // `Number` normalizes undefined/null to zero for an empty analytics result.
  const numericAmount = Number(amount || 0);
  return "BDT " + numericAmount.toLocaleString();
}

/**
 * Displays one subscription metric.
 * @param {object} props - Metric presentation values.
 * @param {import("react").ReactNode} props.icon - Metric icon.
 * @param {string} props.label - Short metric label.
 * @param {string|number} props.value - Main metric value.
 * @param {string} props.detail - Supporting metric text.
 * @param {string} [props.iconClassName=""] - Optional icon style modifier.
 * @returns {import("react").ReactElement} One analytics metric card.
 * @sideEffects None.
 */
function AnalyticsMetric({ icon, label, value, detail, iconClassName = "" }) {
  const className = "metric-card__icon " + iconClassName;

  return (
    <Card className="overview-metric">
      <span className={className}>{icon}</span>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </Card>
  );
}

/**
 * Adds subscription analytics to the existing Admin overview.
 * @returns {import("react").ReactElement} Revenue and payment summaries.
 * @sideEffects Loads the protected subscription analytics API.
 */
export function AdminBusinessAnalytics() {
  const [state, setState] = useState({
    loading: true,
    analytics: null,
    error: "",
  });

  useEffect(
    /**
     * Starts one analytics request when the component mounts.
     * @returns {() => void} Cleanup that blocks late state updates.
     * @sideEffects Calls the Admin API through loadAnalytics.
     */
    function loadBusinessAnalyticsOnMount() {
      let isActive = true;

      /**
       * Loads current simulated business metrics.
       * @returns {Promise<void>}
       * @sideEffects Calls the Admin analytics API and updates local state.
       */
      async function loadAnalytics() {
        // Execution sequence:
        // 1. Request server-aggregated business metrics.
        // 2. Store them only while this effect remains active.
        // 3. Normalize errors and avoid state writes after unmount.
        try {
          const analytics = await adminService.getSubscriptionAnalytics();

          if (isActive) {
            setState({
              loading: false,
              analytics,
              error: "",
            });
          }
        } catch (error) {
          if (isActive) {
            const normalizedError = normalizeApiError(error);

            setState({
              loading: false,
              analytics: null,
              error: normalizedError.message,
            });
          }
        }
      }

      // Do not return this Promise to React; the effect returns cleanup below.
      void loadAnalytics();

      /**
       * Prevents a finished request from updating an unmounted component.
       * @returns {void}
       * @sideEffects Changes the local effect flag.
       */
      return function stopAnalyticsStateUpdates() {
        isActive = false;
      };
    },
    [],
  );

  if (state.loading) {
    return (
      <div className="page-loader-inline">
        <span className="spinner" />
        Loading business analytics
      </div>
    );
  }

  if (state.error) {
    return <div className="alert alert--error">{state.error}</div>;
  }

  const analytics = state.analytics;
  const unsuccessfulPayments =
    analytics.totals.failed + analytics.totals.cancelled;
  const revenueDetail = analytics.totals.completed + " successful payments";
  const premiumDetail = analytics.activeTrials + " active trials";
  const pendingDetail = analytics.totals.failed + " failed attempts";

  return (
    <section
      className="admin-business-analytics"
      aria-label="Subscription business analytics"
    >
      <div className="overview-panel__header">
        <div>
          <h2>Subscription business</h2>
          <p>All financial values below come from development simulations.</p>
        </div>
        <Link to="/admin/payments">View transactions</Link>
      </div>

      <div className="overview-metrics">
        <AnalyticsMetric
          icon={<MoneyIcon />}
          label="Simulated revenue"
          value={formatMoney(analytics.totals.completedRevenue)}
          detail={revenueDetail}
        />
        <AnalyticsMetric
          icon={<ShieldCheckIcon />}
          iconClassName="metric-card__icon--success"
          label="Active Premium"
          value={analytics.activePremiumFamilies}
          detail={premiumDetail}
        />
        <AnalyticsMetric
          icon={<ClockIcon />}
          iconClassName="metric-card__icon--pending"
          label="Pending payments"
          value={analytics.totals.pending}
          detail={pendingDetail}
        />
      </div>

      <div className="admin-business-grid">
        <Card>
          <h3>Plan performance</h3>
          {analytics.planDistribution.length === 0 && (
            <p>No completed payments yet.</p>
          )}
          {analytics.planDistribution.map(
            /**
             * Converts one aggregation row into a plan-performance row.
             * @param {object} plan - Aggregated plan metrics.
             * @returns {import("react").ReactElement} Plan row.
             * @sideEffects None.
             */
            function renderPlanResult(plan) {
              return (
                <div className="admin-plan-row" key={plan._id}>
                  <span>
                    <strong>{plan.name}</strong>
                    <small>{plan.transactions} transactions</small>
                  </span>
                  <strong>{formatMoney(plan.revenue)}</strong>
                </div>
              );
            },
          )}
        </Card>
        <Card>
          <h3>Payment health</h3>
          <div className="admin-plan-row">
            <span>All attempts</span>
            <strong>{analytics.totals.all}</strong>
          </div>
          <div className="admin-plan-row">
            <span>Completed</span>
            <strong>{analytics.totals.completed}</strong>
          </div>
          <div className="admin-plan-row">
            <span>Failed or cancelled</span>
            <strong>{unsuccessfulPayments}</strong>
          </div>
        </Card>
      </div>
    </section>
  );
}
