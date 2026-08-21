import { useCallback, useEffect, useRef, useState } from "react";
import { AppHeader } from "../../components/AppHeader.jsx";
import { Button } from "../../components/Button.jsx";
import { Card } from "../../components/Card.jsx";
import { Modal } from "../../components/Modal.jsx";
import { Pagination } from "../../components/Pagination.jsx";
import { CurrentSubscriptionCard } from "../../components/subscription/CurrentSubscriptionCard.jsx";
import {
  CheckIcon,
  ClockIcon,
  MoneyIcon,
  ShieldCheckIcon,
} from "../../components/Icons.jsx";
import { useToast } from "../../context/ToastContext.jsx";
import { useSubscription } from "../../context/SubscriptionContext.jsx";
import { normalizeApiError } from "../../services/api.js";
import { subscriptionService } from "../../services/subscriptionService.js";

const PAYMENT_METHODS = [
  { value: "test_card", label: "Test card" },
  { value: "test_mobile_banking", label: "Test mobile banking" },
  { value: "test_wallet", label: "Test wallet" },
];

/**
 * Formats a stored date and time for subscription presentation.
 * @param {string|Date|null} value - Stored date.
 * @returns {string} Local date/time or Not available.
 * @sideEffects None.
 */
function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : "Not available";
}

/**
 * Formats the access period stored with a subscription plan.
 * @param {{durationValue: number, durationType: string}} plan - Backend-controlled plan duration.
 * @returns {string} Human-readable access period.
 * @sideEffects None.
 */
function formatPlanDuration(plan) {
  if (plan.durationType === "hours" && plan.durationValue === 24) {
    return "24-hour access";
  }

  if (plan.durationValue === 1) {
    if (plan.durationType === "months") {
      return "1 month";
    }

    if (plan.durationType === "years") {
      return "1 year";
    }
  }

  return `${plan.durationValue} ${plan.durationType}`;
}

/**
 * Displays one backend-controlled Premium plan without repeating shared benefits.
 * @param {{plan: object, onSelect: (plan: object) => void}} props - Plan data and checkout selection handler.
 * @returns {import("react").ReactElement} One comparison-friendly plan card.
 * @sideEffects Calls `onSelect` when the purchase button is activated.
 */
function SubscriptionPlanCard({ plan, onSelect }) {
  let badge = "Flexible access";
  let className = "subscription-plan-card";

  if (plan.code === "monthly") {
    badge = "Most popular";
    className += " subscription-plan-card--featured";
  }

  if (plan.code === "yearly") {
    badge = "Best long-term value";
  }

  return (
    <Card className={className}>
      <div className="subscription-plan-card__topline">
        <span>{formatPlanDuration(plan)}</span>
        <small>{badge}</small>
      </div>
      <h3>{plan.name}</h3>
      <div className="subscription-plan-card__price">
        <strong>BDT {plan.price.toLocaleString()}</strong>
        <span>one-time payment</span>
      </div>
      <p>{plan.description}</p>
      <div className="subscription-plan-card__included">
        <CheckIcon size={16} />
        Complete Premium access
      </div>
      <Button onClick={() => onSelect(plan)}>
        Choose {plan.name}
      </Button>
    </Card>
  );
}

/**
 * Renders Family trial, plans, prototype checkout, access, and payment history.
 * @returns {import("react").ReactElement} Authenticated subscription page.
 * @sideEffects Loads and mutates subscription/payment data through the API.
 */
export function FamilySubscriptionPage() {
  const [state, setState] = useState({
    loading: true,
    plans: [],
    subscription: null,
    access: null,
    reminder: null,
    payments: [],
    paymentPagination: null,
    error: "",
  });
  const [checkout, setCheckout] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("test_card");
  const [paymentPage, setPaymentPage] = useState(1);
  const [busy, setBusy] = useState("");
  const settledPaymentIds = useRef(new Set());
  const { showToast } = useToast();
  const { refreshSubscription } = useSubscription();
  const reminderDismissalHasEnded =
    state.reminder?.dismissedUntil &&
    new Date(state.reminder.dismissedUntil).getTime() <= Date.now();
  const shouldShowReminder =
    state.reminder &&
    (!state.reminder.dismissedUntil || reminderDismissalHasEnded);

  /**
   * Reloads plans, access, reminder, and payment history.
   * @returns {Promise<void>}
   * @sideEffects Calls three subscription APIs and updates page state.
   */
  const loadPage = useCallback(async () => {
    try {
      const results = await Promise.all([
        subscriptionService.listPlans(),
        refreshSubscription(),
        subscriptionService.listPayments({ page: paymentPage, limit: 3 }),
      ]);
      setState({
        loading: false,
        plans: results[0],
        subscription: results[1].subscription,
        access: results[1].access,
        reminder: results[1].reminder,
        payments: results[2].payments,
        paymentPagination: results[2].pagination,
        error: "",
      });
    } catch (error) {
      setState((current) => ({
        ...current,
        loading: false,
        error: normalizeApiError(error).message,
      }));
    }
  }, [paymentPage, refreshSubscription]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const pendingPaymentId = checkout?.payment?._id || "";

  useEffect(() => {
    /**
     * Cancels an unfinished transaction when navigation unmounts this checkout.
     * @returns {void}
     * @sideEffects Sends a best-effort cancellation request to the backend.
     */
    function cancelAbandonedCheckout() {
      if (
        pendingPaymentId &&
        !settledPaymentIds.current.has(pendingPaymentId)
      ) {
        subscriptionService.cancelPayment(pendingPaymentId).catch(() => {
          // Backend timeout cleanup handles interruptions where this request fails.
        });
      }
    }

    return cancelAbandonedCheckout;
  }, [pendingPaymentId]);

  /** Activates the one-time trial. @returns {Promise<void>} @sideEffects Calls API and refreshes page. */
  async function activateTrial() {
    setBusy("trial");
    try {
      await subscriptionService.activateTrial();
      showToast("Your seven-day Premium trial is active.", "success");
      await loadPage();
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    } finally {
      setBusy("");
    }
  }

  /** Creates a pending checkout payment. @returns {Promise<void>} @sideEffects Calls API and updates modal. */
  async function beginCheckout() {
    if (!checkout?.plan) {
      return;
    }

    setBusy("create-payment");
    try {
      const payment = await subscriptionService.purchase({
        planCode: checkout.plan.code,
        paymentMethod,
      });
      setCheckout({ plan: checkout.plan, payment });
      await loadPage();
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    } finally {
      setBusy("");
    }
  }

  /**
   * Completes, fails, or cancels the pending simulation.
   * @param {"success"|"failure"|"cancel"} action - Prototype result.
   * @returns {Promise<void>}
   * @sideEffects Calls payment API, closes modal, and refreshes state.
   */
  async function finishCheckout(action) {
    const paymentId = checkout?.payment?._id;

    if (!paymentId) {
      return;
    }

    setBusy(action);
    try {
      if (action === "success") {
        await subscriptionService.simulateSuccess(paymentId);
        showToast("Prototype payment completed. Premium is active.", "success");
      } else if (action === "failure") {
        await subscriptionService.simulateFailure(paymentId);
        showToast("The simulated payment failed. Access was not changed.", "info");
      } else {
        await subscriptionService.cancelPayment(paymentId);
      }
      settledPaymentIds.current.add(paymentId);
      setCheckout(null);
      await loadPage();
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    } finally {
      setBusy("");
    }
  }

    /**
   * Closes checkout and cancels a pending payment before hiding the modal.
   * @returns {Promise<void>}
   * @sideEffects May call the cancellation API, refresh history, and close the modal.
   */
  async function closeCheckout() {
    if (busy) {
      return;
    }

    const paymentId = checkout?.payment?._id;

    if (!paymentId) {
      setCheckout(null);
      return;
    }

    setBusy("abandon");

    try {
      await subscriptionService.cancelPayment(paymentId);
      settledPaymentIds.current.add(paymentId);
      setCheckout(null);
      showToast("The unfinished payment was cancelled.", "info");
      await loadPage();
    } catch (error) {
      showToast(normalizeApiError(error).message, "error");
    } finally {
      setBusy("");
    }
  }
/** Dismisses the current renewal reminder for one day. @returns {Promise<void>} @sideEffects Persists dismissal. */
  async function dismissReminder() {
    if (!state.reminder?._id) {
      return;
    }
    await subscriptionService.dismissReminder(state.reminder._id, 24);
    setState((current) => ({ ...current, reminder: null }));
  }

  if (state.loading) {
    return <main><AppHeader /><div className="page-loader"><span className="spinner" /> Loading subscription</div></main>;
  }

  return (
    <main>
      <AppHeader />
      <div className="feature-page subscription-page">
        <header className="subscription-page-heading">
          <div>
            <span className="eyebrow">Family subscription</span>
            <h1>Premium care, on your terms.</h1>
            <p>
              Every plan unlocks the same Premium tools. Choose the access period
              that matches your family&apos;s current care needs.
            </p>
          </div>
          <span className="subscription-page-heading__note">
            <ShieldCheckIcon size={17} />
            Prototype payments for testing
          </span>
        </header>
        {state.error && <div className="alert alert--error">{state.error}</div>}
        {shouldShowReminder && (
          <div className="subscription-reminder">
            <div><strong>{state.reminder.title}</strong><p>{state.reminder.message}</p></div>
            <Button variant="secondary" onClick={dismissReminder}>Remind me later</Button>
          </div>
        )}
        <CurrentSubscriptionCard
          subscription={state.subscription}
          access={state.access}
        />
        <section className="subscription-trial-card">
          <div className="subscription-trial-card__icon">
            <ShieldCheckIcon />
          </div>
          <div>
            <span className="eyebrow">One-time trial</span>
            <h2>Explore every Premium tool for seven days.</h2>
            <p>No test payment is required to activate an eligible trial.</p>
          </div>
          {!state.subscription?.trialUsed ? (
            <Button isLoading={busy === "trial"} onClick={activateTrial}>Activate free trial</Button>
          ) : (
            <span className="subscription-trial-card__used">
              <CheckIcon size={16} />
              Trial already used
            </span>
          )}
        </section>

        <section className="subscription-includes">
          <div className="subscription-includes__heading">
            <span className="eyebrow">Included with every plan</span>
            <h2>One Premium experience. Three access periods.</h2>
          </div>
          <div className="subscription-includes__items">
            <span><CheckIcon size={16} /> Caregiver booking coordination</span>
            <span><CheckIcon size={16} /> Wellness insights and AI summaries</span>
            <span><CheckIcon size={16} /> Early alerts and advanced vital trends</span>
            <span><CheckIcon size={16} /> Manual renewal with no automatic billing</span>
          </div>
        </section>

        <section className="subscription-plan-section" aria-labelledby="plan-options-title">
          <div className="subscription-plan-section__heading">
            <div>
              <span className="eyebrow">Choose your duration</span>
              <h2 id="plan-options-title">Simple options without hidden differences.</h2>
            </div>
            <p>Prices are backend-controlled development values shown in BDT.</p>
          </div>
          <div className="subscription-plan-grid">
          {state.plans.map((plan) => (
            <SubscriptionPlanCard
              key={plan._id}
              plan={plan}
              onSelect={(selectedPlan) => {
                setCheckout({ plan: selectedPlan, payment: null });
              }}
            />
          ))}
          </div>
        </section>
        <section className="subscription-history" id="payment-history">
          <div className="page-heading"><span className="eyebrow">Prototype receipts</span><h2>Payment history</h2></div>
          {!state.payments.length && <div className="empty-state">No prototype payments yet.</div>}
          {state.payments.map((payment) => (
            <div className="subscription-payment-row" key={payment._id}>
              <div><strong>{payment.planSnapshot.name}</strong><span>Transaction ID: {payment.transactionReference}</span>{payment.confirmationReference && <small>Confirmation: {payment.confirmationReference}</small>}</div>
              <span>BDT {payment.amount.toLocaleString()}</span>
              <span>{payment.paymentMethod.replaceAll("_", " ")}</span>
              <span className={"status-badge status-badge--" + payment.status}>{payment.status}</span>
              <time>{formatDateTime(payment.completedAt || payment.createdAt)}</time>
            </div>
          ))}
          {state.paymentPagination && <Pagination page={state.paymentPagination.page} pages={state.paymentPagination.pages} total={state.paymentPagination.total} label="payments" disabled={state.loading} onPageChange={setPaymentPage} />}
        </section>
      </div>
      <Modal isOpen={Boolean(checkout)} title="Prototype checkout" onClose={closeCheckout}>
        {checkout && (
          <div className="subscription-modal-content">
            <div className="alert alert--warning">Development payment simulation. Do not enter real financial information.</div>
            <div className="subscription-checkout-summary"><MoneyIcon /><div><strong>{checkout.plan.name}</strong><span>BDT {checkout.plan.price.toLocaleString()}</span></div></div>
            {!checkout.payment ? (
              <>
                <label className="field"><span>Test payment method</span><select className="input" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>{PAYMENT_METHODS.map((method) => <option value={method.value} key={method.value}>{method.label}</option>)}</select></label>
                <div className="modal-actions"><Button variant="secondary" onClick={closeCheckout}>Cancel</Button><Button isLoading={busy === "create-payment"} onClick={beginCheckout}>Create test payment</Button></div>
              </>
            ) : (
              <>
                <p><ClockIcon size={16} /> Transaction ID: {checkout.payment.transactionReference}</p>
                <div className="prototype-actions"><Button isLoading={busy === "success"} disabled={Boolean(busy)} onClick={() => finishCheckout("success")}>Simulate success</Button><Button variant="secondary" isLoading={busy === "failure"} disabled={Boolean(busy)} onClick={() => finishCheckout("failure")}>Simulate failure</Button><Button variant="ghost" disabled={Boolean(busy)} onClick={() => finishCheckout("cancel")}>Cancel payment</Button></div>
              </>
            )}
          </div>
        )}
      </Modal>
    </main>
  );
}
