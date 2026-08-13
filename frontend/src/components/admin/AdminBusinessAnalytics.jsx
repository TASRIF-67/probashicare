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
  return "BDT " + Number(amount || 0).toLocaleString();
}

/**
 * Adds subscription analytics to the existing Admin overview.
 * @returns {import("react").ReactElement} Revenue, access, plan, and transaction summaries.
 * @sideEffects Loads the protected subscription analytics API.
 */
export function AdminBusinessAnalytics() {
  const [state, setState] = useState({
    loading: true,
    analytics: null,
    error: "",
  });

  useEffect(() => {
    let isActive = true;

    /**
     * Loads current simulated business metrics.
     * @returns {Promise<void>}
     * @sideEffects Calls the Admin analytics API and updates local state.
     */
    async function loadAnalytics() {
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
          setState({
            loading: false,
            analytics: null,
            error: normalizeApiError(error).message,
          });
        }
      }
    }

    loadAnalytics();

    return () => {
      isActive = false;
    };
  }, []);

  if (state.loading) {
    return <div className="page-loader-inline"><span className="spinner" /> Loading business analytics</div>;
  }

  if (state.error) {
    return <div className="alert alert--error">{state.error}</div>;
  }

  const analytics = state.analytics;

  return (
    <section className="admin-business-analytics" aria-label="Subscription business analytics">
      <div className="overview-panel__header">
        <div>
          <h2>Subscription business</h2>
          <p>All financial values below come from development simulations.</p>
        </div>
        <Link to="/admin/payments">View transactions</Link>
      </div>

      <div className="overview-metrics">
        <Card className="overview-metric">
          <span className="metric-card__icon"><MoneyIcon /></span>
          <div><small>Simulated revenue</small><strong>{formatMoney(analytics.totals.completedRevenue)}</strong><span>{analytics.totals.completed} successful payments</span></div>
        </Card>
        <Card className="overview-metric">
          <span className="metric-card__icon metric-card__icon--success"><ShieldCheckIcon /></span>
          <div><small>Active Premium</small><strong>{analytics.activePremiumFamilies}</strong><span>{analytics.activeTrials} active trials</span></div>
        </Card>
        <Card className="overview-metric">
          <span className="metric-card__icon metric-card__icon--pending"><ClockIcon /></span>
          <div><small>Pending payments</small><strong>{analytics.totals.pending}</strong><span>{analytics.totals.failed} failed attempts</span></div>
        </Card>
      </div>

      <div className="admin-business-grid">
        <Card>
          <h3>Plan performance</h3>
          {!analytics.planDistribution.length && <p>No completed payments yet.</p>}
          {analytics.planDistribution.map((plan) => (
            <div className="admin-plan-row" key={plan._id}>
              <span><strong>{plan.name}</strong><small>{plan.transactions} transactions</small></span>
              <strong>{formatMoney(plan.revenue)}</strong>
            </div>
          ))}
        </Card>
        <Card>
          <h3>Payment health</h3>
          <div className="admin-plan-row"><span>All attempts</span><strong>{analytics.totals.all}</strong></div>
          <div className="admin-plan-row"><span>Completed</span><strong>{analytics.totals.completed}</strong></div>
          <div className="admin-plan-row"><span>Failed or cancelled</span><strong>{analytics.totals.failed + analytics.totals.cancelled}</strong></div>
        </Card>
      </div>
    </section>
  );
}
