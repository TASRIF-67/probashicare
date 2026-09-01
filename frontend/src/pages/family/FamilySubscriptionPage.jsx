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
  {
    value: "test_card",
    label: "Test card",
  },
  {
    value: "test_mobile_banking",
    label: "Test mobile banking",
  },
  {
    value: "test_wallet",
    label: "Test wallet",
  },
];

const PAYMENT_PAGE_SIZE = 3;
const STRIPE_STATUS_ATTEMPTS = 6;
const STRIPE_STATUS_DELAY_MILLISECONDS = 1000;

/**
 * Formats a stored date and time for subscription presentation.
 * @param {string|Date|null} value - Stored date.
 * @returns {string} Local date/time or Not available.
 * @sideEffects None.
 */
function formatDateTime(value) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleString();
}

/**
 * Formats the access period stored with a subscription plan.
 * @param {{durationValue: number, durationType: string}} plan - Plan duration.
 * @returns {string} Human-readable access period.
 * @sideEffects None.
 */
function formatPlanDuration(plan) {
  if (plan.durationType === "hours" && plan.durationValue === 24) {
    return "24-hour access";
  }

  if (plan.durationValue === 1 && plan.durationType === "months") {
    return "1 month";
  }

  if (plan.durationValue === 1 && plan.durationType === "years") {
    return "1 year";
  }

  return plan.durationValue + " " + plan.durationType;
}

/**
 * Converts an internal payment method into a readable label.
 * @param {object} payment - Stored payment snapshot.
 * @returns {string} Provider or prototype method label.
 * @sideEffects None.
 */
function formatPaymentMethod(payment) {
  if (payment.provider === "stripe") {
    return "Stripe sandbox";
  }

  // `split` creates an array around underscores and `join` reconnects the
  // pieces with spaces, for example "test_card" becomes "test card".
  return String(payment.paymentMethod || "")
    .split("_")
    .join(" ");
}

/**
 * Waits briefly between Stripe status requests.
 * @param {number} milliseconds - Delay duration.
 * @returns {Promise<void>} Promise resolved after the browser timer finishes.
 * @sideEffects Creates one browser timer.
 */
function waitForDelay(milliseconds) {
  // A Promise represents a value that will become available in the future.
  return new Promise(
    /**
     * Resolves the Promise when the browser timer completes.
     * @param {() => void} resolve - Promise completion function.
     * @returns {void}
     * @sideEffects Schedules one browser timer.
     */
    function resolveAfterTimer(resolve) {
      window.setTimeout(resolve, milliseconds);
    },
  );
}

/**
 * Displays one backend-controlled Premium plan.
 * @param {{plan: object, onSelect: (plan: object) => void}} props - Card data.
 * @returns {import("react").ReactElement} One plan card.
 * @sideEffects Calls onSelect when the button is activated.
 */
function SubscriptionPlanCard({ plan, onSelect }) {
  let badge = "Flexible access";
  let className = "subscription-plan-card";

  if (plan.code === "monthly") {
    badge = "Most popular";
    className += " subscription-plan-card--featured";
  } else if (plan.code === "yearly") {
    badge = "Best long-term value";
  }

  /**
   * Sends the full selected plan back to the page.
   * @returns {void}
   * @sideEffects Opens the checkout dialog through parent state.
   */
  function selectPlan() {
    onSelect(plan);
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
      <Button onClick={selectPlan}>Choose {plan.name}</Button>
    </Card>
  );
}

/**
 * Displays one Family-owned payment record.
 * @param {{payment: object}} props - Payment to display.
 * @returns {import("react").ReactElement} Payment history row.
 * @sideEffects None.
 */
function PaymentHistoryRow({ payment }) {
  const displayedTime = payment.completedAt || payment.createdAt;
  const paymentMethodLabel = formatPaymentMethod(payment);

  return (
    <div className="subscription-payment-row">
      <div>
        <strong>{payment.planSnapshot.name}</strong>
        <span>Transaction ID: {payment.transactionReference}</span>
        {payment.confirmationReference && (
          <small>Confirmation: {payment.confirmationReference}</small>
        )}
      </div>
      <span>BDT {payment.amount.toLocaleString()}</span>
      <span>{paymentMethodLabel}</span>
      <span className={"status-badge status-badge--" + payment.status}>
        {payment.status}
      </span>
      <time>{formatDateTime(displayedTime)}</time>
    </div>
  );
}

/**
 * Displays the hosted Stripe or prototype payment steps.
 * @param {object} props - Checkout state and action handlers.
 * @param {object|null} props.checkout - Selected plan and optional payment.
 * @param {boolean} props.stripeEnabled - Whether Stripe is configured.
 * @param {string} props.paymentMethod - Selected prototype method.
 * @param {string} props.busy - Active operation name.
 * @param {Function} props.onPaymentMethodChange - Payment-method handler.
 * @param {() => Promise<void>} props.onClose - Close handler.
 * @param {() => Promise<void>} props.onBeginPrototype - Prototype handler.
 * @param {() => Promise<void>} props.onBeginStripe - Stripe handler.
 * @param {Function} props.onFinishPrototype - Prototype settlement handler.
 * @returns {import("react").ReactElement} Checkout modal.
 * @sideEffects Calls supplied handlers after user actions.
 */
function SubscriptionCheckoutModal({
  checkout,
  stripeEnabled,
  paymentMethod,
  busy,
  onPaymentMethodChange,
  onClose,
  onBeginPrototype,
  onBeginStripe,
  onFinishPrototype,
}) {
  let title = "Prototype checkout";
  let warning =
    "Development simulation. Do not enter real financial information.";

  if (stripeEnabled) {
    title = "Stripe test checkout";
    warning = "Stripe sandbox mode uses test cards and never moves real money.";
  }

  /**
   * Completes the prototype payment.
   * @returns {Promise<void>}
   * @sideEffects Calls the parent settlement handler.
   */
  async function simulateSuccess() {
    await onFinishPrototype("success");
  }

  /**
   * Fails the prototype payment.
   * @returns {Promise<void>}
   * @sideEffects Calls the parent settlement handler.
   */
  async function simulateFailure() {
    await onFinishPrototype("failure");
  }

  /**
   * Cancels the prototype payment.
   * @returns {Promise<void>}
   * @sideEffects Calls the parent settlement handler.
   */
  async function cancelPrototype() {
    await onFinishPrototype("cancel");
  }

  let checkoutStep = null;

  if (checkout && stripeEnabled) {
    checkoutStep = (
      <>
        <p>
          Stripe will open its secure hosted test page. Use card 4242 4242 4242
          4242, any future expiry, and any CVC.
        </p>
        <div className="modal-actions">
          <Button
            variant="secondary"
            disabled={Boolean(busy)}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            isLoading={busy === "stripe-checkout"}
            disabled={Boolean(busy)}
            onClick={onBeginStripe}
          >
            Continue to Stripe sandbox
          </Button>
        </div>
      </>
    );
  } else if (checkout && !checkout.payment) {
    checkoutStep = (
      <>
        <label className="field">
          <span>Test payment method</span>
          <select
            className="input"
            value={paymentMethod}
            onChange={onPaymentMethodChange}
          >
            {PAYMENT_METHODS.map(
              /**
               * Converts one payment option into an option element.
               * @param {{value: string, label: string}} method - Option data.
               * @returns {import("react").ReactElement} Select option.
               * @sideEffects None.
               */
              function renderPaymentMethod(method) {
                return (
                  <option value={method.value} key={method.value}>
                    {method.label}
                  </option>
                );
              },
            )}
          </select>
        </label>
        <div className="modal-actions">
          <Button
            variant="secondary"
            disabled={Boolean(busy)}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            isLoading={busy === "create-payment"}
            disabled={Boolean(busy)}
            onClick={onBeginPrototype}
          >
            Create test payment
          </Button>
        </div>
      </>
    );
  } else if (checkout?.payment) {
    checkoutStep = (
      <>
        <p>
          <ClockIcon size={16} />
          Transaction ID: {checkout.payment.transactionReference}
        </p>
        <div className="prototype-actions">
          <Button
            isLoading={busy === "success"}
            disabled={Boolean(busy)}
            onClick={simulateSuccess}
          >
            Simulate success
          </Button>
          <Button
            variant="secondary"
            isLoading={busy === "failure"}
            disabled={Boolean(busy)}
            onClick={simulateFailure}
          >
            Simulate failure
          </Button>
          <Button
            variant="ghost"
            disabled={Boolean(busy)}
            onClick={cancelPrototype}
          >
            Cancel payment
          </Button>
        </div>
      </>
    );
  }

  return (
    <Modal isOpen={Boolean(checkout)} title={title} onClose={onClose}>
      {checkout && (
        <div className="subscription-modal-content">
          <div className="alert alert--warning">{warning}</div>
          <div className="subscription-checkout-summary">
            <MoneyIcon />
            <div>
              <strong>{checkout.plan.name}</strong>
              <span>BDT {checkout.plan.price.toLocaleString()}</span>
            </div>
          </div>
          {checkoutStep}
        </div>
      )}
    </Modal>
  );
}

/**
 * Renders Family trial, plans, checkout, access, and payment history.
 * @returns {import("react").ReactElement} Authenticated subscription page.
 * @sideEffects Loads and mutates subscription/payment data through the API.
 */
export function FamilySubscriptionPage() {
  const [state, setState] = useState({
    loading: true,
    plans: [],
    paymentOptions: null,
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
  // `useRef` retains the same Set between renders without causing renders when
  // entries are added. The Set prevents cancelling a transaction twice.
  const settledPaymentIds = useRef(new Set());
  const stripeReturnHandled = useRef(false);
  const { showToast } = useToast();
  const { refreshSubscription } = useSubscription();

  let reminderDismissalHasEnded = false;

  if (state.reminder?.dismissedUntil) {
    const dismissalEnd = new Date(state.reminder.dismissedUntil).getTime();
    reminderDismissalHasEnded = dismissalEnd <= Date.now();
  }

  const reminderWasNotDismissed = !state.reminder?.dismissedUntil;
  const shouldShowReminder = Boolean(
    state.reminder && (reminderWasNotDismissed || reminderDismissalHasEnded),
  );

  /**
   * Reloads plans, access, reminder, and one payment-history page.
   * @returns {Promise<void>}
   * @sideEffects Calls three APIs concurrently and updates page state.
   */
  const loadPage = useCallback(
    /**
     * Implements the memoized subscription-page loading operation.
     * @returns {Promise<void>} Resolves after page state contains the latest data.
     * @sideEffects Calls three APIs concurrently and updates page state.
     */
    async function loadSubscriptionPage() {
      try {
        // `Promise.all` starts independent requests together and waits until all
        // of them succeed. Destructuring gives each result a readable name.
        const results = await Promise.all([
          subscriptionService.listPlans(),
          refreshSubscription(),
          subscriptionService.listPayments({
            page: paymentPage,
            limit: PAYMENT_PAGE_SIZE,
          }),
        ]);
        const planData = results[0];
        const subscriptionData = results[1];
        const paymentData = results[2];

        setState({
          loading: false,
          plans: planData.plans,
          paymentOptions: planData.paymentOptions,
          subscription: subscriptionData.subscription,
          access: subscriptionData.access,
          reminder: subscriptionData.reminder,
          payments: paymentData.payments,
          paymentPagination: paymentData.pagination,
          error: "",
        });
      } catch (error) {
        const normalizedError = normalizeApiError(error);

        setState(
          /**
           * Keeps loaded data while applying the latest request error.
           * @param {object} currentState - Existing page state.
           * @returns {object} Updated page state.
           * @sideEffects None.
           */
          function preserveDataAndShowError(currentState) {
            // The spread operator copies existing properties before replacing
            // loading and error, so previously loaded page data is preserved.
            return {
              ...currentState,
              loading: false,
              error: normalizedError.message,
            };
          },
        );
      }
    },
    [paymentPage, refreshSubscription],
  );

  useEffect(
    /**
     * Reloads page data when the selected history page changes.
     * @returns {void}
     * @sideEffects Starts the asynchronous page request.
     */
    function loadWhenPageChanges() {
      // The Promise is intentionally not returned to React.
      void loadPage();
    },
    [loadPage],
  );

  useEffect(
    /**
     * Reconciles Stripe query parameters once after browser return.
     * @returns {undefined}
     * @sideEffects May poll payment state, refresh data, toast, and clean URL.
     */
    function reconcileStripeBrowserReturn() {
      if (stripeReturnHandled.current) {
        return undefined;
      }

      // `URLSearchParams` safely reads values from the browser query string.
      const parameters = new URLSearchParams(window.location.search);
      const stripeResult = parameters.get("stripe");
      const sessionId = parameters.get("session_id");
      const paymentId = parameters.get("payment_id");

      if (!stripeResult) {
        return undefined;
      }

      stripeReturnHandled.current = true;

      /**
       * Reconciles Stripe's browser redirect with signed webhook state.
       * @returns {Promise<void>}
       * @sideEffects Polls caller-owned status, refreshes data, shows a toast,
       * and removes Stripe parameters from the URL.
       */
      async function handleStripeReturn() {
        try {
          if (stripeResult === "success" && sessionId) {
            let payment = null;

            // The webhook can arrive just after the browser redirect. This loop
            // performs a small, bounded number of caller-owned status checks.
            for (
              let attempt = 0;
              attempt < STRIPE_STATUS_ATTEMPTS;
              attempt += 1
            ) {
              payment =
                await subscriptionService.getStripeCheckoutStatus(sessionId);

              if (payment.status !== "pending") {
                break;
              }

              await waitForDelay(STRIPE_STATUS_DELAY_MILLISECONDS);
            }

            if (payment?.status === "completed") {
              showToast(
                "Stripe test payment completed. Premium access is active.",
                "success",
              );
            } else {
              showToast(
                "Stripe accepted the test checkout. The signed webhook is still processing.",
                "info",
              );
            }
          } else if (stripeResult === "cancelled" && paymentId) {
            await subscriptionService.cancelStripeCheckout(paymentId);
            showToast("Stripe test checkout was cancelled.", "info");
          }

          await loadPage();
        } catch (error) {
          const normalizedError = normalizeApiError(error);
          showToast(normalizedError.message, "error");
        } finally {
          // `replaceState` cleans the address bar without reloading the page.
          window.history.replaceState({}, "", "/subscription");
        }
      }

      void handleStripeReturn();
      return undefined;
    },
    [loadPage, showToast],
  );

  const pendingPaymentId = checkout?.payment?._id || "";

  useEffect(
    /**
     * Registers cleanup for an unfinished prototype payment.
     * @returns {() => void} React cleanup function.
     * @sideEffects May send best-effort cancellation during cleanup.
     */
    function cancelPrototypePaymentWhenCheckoutUnmounts() {
      /**
       * Cancels an unfinished transaction when navigation unmounts checkout.
       * @returns {void}
       * @sideEffects Sends a best-effort cancellation request.
       */
      function cancelAbandonedCheckout() {
        const paymentWasSettled =
          settledPaymentIds.current.has(pendingPaymentId);

        if (pendingPaymentId && !paymentWasSettled) {
          // `catch` handles a rejected Promise. Timeout cleanup on the backend
          // remains the fallback if this best-effort request cannot finish.
          void subscriptionService.cancelPayment(pendingPaymentId).catch(
            /**
             * Leaves stale-payment cleanup to the backend after failure.
             * @returns {undefined}
             * @sideEffects None.
             */
            function ignoreNavigationCancellationFailure() {
              return undefined;
            },
          );
        }
      }

      return cancelAbandonedCheckout;
    },
    [pendingPaymentId],
  );

  /**
   * Opens checkout for a selected plan.
   * @param {object} selectedPlan - Backend plan record.
   * @returns {void}
   * @sideEffects Updates checkout state.
   */
  function selectPlan(selectedPlan) {
    setCheckout({
      plan: selectedPlan,
      payment: null,
    });
  }

  /**
   * Stores the selected prototype payment method.
   * @param {import("react").ChangeEvent<HTMLSelectElement>} event - Change event.
   * @returns {void}
   * @sideEffects Updates payment-method state.
   */
  function changePaymentMethod(event) {
    setPaymentMethod(event.target.value);
  }

  /**
   * Activates the one-time trial.
   * @returns {Promise<void>}
   * @sideEffects Calls the API, shows feedback, and refreshes the page.
   */
  async function activateTrial() {
    setBusy("trial");

    try {
      await subscriptionService.activateTrial();
      showToast("Your seven-day Premium trial is active.", "success");
      await loadPage();
    } catch (error) {
      const normalizedError = normalizeApiError(error);
      showToast(normalizedError.message, "error");
    } finally {
      setBusy("");
    }
  }

  /**
   * Creates a Stripe sandbox Session and opens its hosted payment page.
   * @returns {Promise<void>}
   * @sideEffects Calls the API and navigates away to Stripe Checkout.
   */
  async function beginStripeCheckout() {
    if (!checkout?.plan) {
      return;
    }

    setBusy("stripe-checkout");

    try {
      const result = await subscriptionService.createStripeCheckout(
        checkout.plan.code,
      );
      window.location.assign(result.checkoutUrl);
    } catch (error) {
      const normalizedError = normalizeApiError(error);
      showToast(normalizedError.message, "error");
      setBusy("");
    }
  }

  /**
   * Creates a pending prototype payment from the selected plan and method.
   * @returns {Promise<void>}
   * @sideEffects Calls the API and places the payment in checkout state.
   */
  async function beginPrototypeCheckout() {
    if (!checkout?.plan) {
      return;
    }

    setBusy("create-payment");

    try {
      const requestBody = {
        planCode: checkout.plan.code,
        paymentMethod,
      };
      const payment = await subscriptionService.purchase(requestBody);

      setCheckout({
        plan: checkout.plan,
        payment,
      });
      await loadPage();
    } catch (error) {
      const normalizedError = normalizeApiError(error);
      showToast(normalizedError.message, "error");
    } finally {
      setBusy("");
    }
  }

  /**
   * Completes, fails, or cancels the pending prototype payment.
   * @param {"success"|"failure"|"cancel"} action - Requested test result.
   * @returns {Promise<void>}
   * @sideEffects Calls the settlement API, closes checkout, and refreshes data.
   */
  async function finishPrototypeCheckout(action) {
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
        showToast(
          "The simulated payment failed. Access was not changed.",
          "info",
        );
      } else {
        await subscriptionService.cancelPayment(paymentId);
      }

      // `Set.add` stores a unique payment ID so cleanup will not cancel it.
      settledPaymentIds.current.add(paymentId);
      setCheckout(null);
      await loadPage();
    } catch (error) {
      const normalizedError = normalizeApiError(error);
      showToast(normalizedError.message, "error");
    } finally {
      setBusy("");
    }
  }

  /**
   * Closes checkout and cancels a pending prototype payment first.
   * @returns {Promise<void>}
   * @sideEffects May cancel a payment, refresh history, and close the modal.
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
      const normalizedError = normalizeApiError(error);
      showToast(normalizedError.message, "error");
    } finally {
      setBusy("");
    }
  }

  /**
   * Dismisses the current renewal reminder for one day.
   * @returns {Promise<void>}
   * @sideEffects Persists dismissal and updates page state.
   */
  async function dismissReminder() {
    const reminderId = state.reminder?._id;

    if (!reminderId || busy) {
      return;
    }

    setBusy("dismiss-reminder");

    try {
      await subscriptionService.dismissReminder(reminderId, 24);
      setState(
        /**
         * Removes the successfully dismissed reminder from local state.
         * @param {object} currentState - Existing page state.
         * @returns {object} State without a visible reminder.
         * @sideEffects None.
         */
        function removeDismissedReminder(currentState) {
          return {
            ...currentState,
            reminder: null,
          };
        },
      );
    } catch (error) {
      const normalizedError = normalizeApiError(error);
      showToast(normalizedError.message, "error");
    } finally {
      setBusy("");
    }
  }

  // `Boolean` converts undefined/true/false into an explicit boolean.
  const stripeEnabled = Boolean(state.paymentOptions?.stripeEnabled);

  if (state.loading) {
    return (
      <main>
        <AppHeader />
        <div className="page-loader">
          <span className="spinner" />
          Loading subscription
        </div>
      </main>
    );
  }

  let paymentProviderLabel = "Prototype payments for testing";

  if (stripeEnabled) {
    paymentProviderLabel = "Stripe secure sandbox payments";
  }

  let trialAction = (
    <span className="subscription-trial-card__used">
      <CheckIcon size={16} />
      Trial already used
    </span>
  );

  if (!state.subscription?.trialUsed) {
    trialAction = (
      <Button
        isLoading={busy === "trial"}
        disabled={Boolean(busy)}
        onClick={activateTrial}
      >
        Activate free trial
      </Button>
    );
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
              Every plan unlocks the same Premium tools. Choose the access
              period that matches your family&apos;s current care needs.
            </p>
          </div>
          <span className="subscription-page-heading__note">
            <ShieldCheckIcon size={17} />
            {paymentProviderLabel}
          </span>
        </header>

        {state.error && <div className="alert alert--error">{state.error}</div>}

        {shouldShowReminder && (
          <div className="subscription-reminder">
            <div>
              <strong>{state.reminder.title}</strong>
              <p>{state.reminder.message}</p>
            </div>
            <Button
              variant="secondary"
              isLoading={busy === "dismiss-reminder"}
              disabled={Boolean(busy)}
              onClick={dismissReminder}
            >
              Remind me later
            </Button>
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
          {trialAction}
        </section>

        <section className="subscription-includes">
          <div className="subscription-includes__heading">
            <span className="eyebrow">Included with every plan</span>
            <h2>One Premium experience. Three access periods.</h2>
          </div>
          <div className="subscription-includes__items">
            <span>
              <CheckIcon size={16} />
              Caregiver booking coordination
            </span>
            <span>
              <CheckIcon size={16} />
              Wellness insights and AI summaries
            </span>
            <span>
              <CheckIcon size={16} />
              Early alerts and advanced vital trends
            </span>
            <span>
              <CheckIcon size={16} />
              Manual renewal with no automatic billing
            </span>
          </div>
        </section>

        <section
          className="subscription-plan-section"
          aria-labelledby="plan-options-title"
        >
          <div className="subscription-plan-section__heading">
            <div>
              <span className="eyebrow">Choose your duration</span>
              <h2 id="plan-options-title">
                Simple options without hidden differences.
              </h2>
            </div>
            <p>
              Prices are backend-controlled development values shown in BDT.
            </p>
          </div>
          <div className="subscription-plan-grid">
            {state.plans.map(
              /**
               * Converts one plan record into a plan card.
               * @param {object} plan - Backend plan record.
               * @returns {import("react").ReactElement} Plan card.
               * @sideEffects None.
               */
              function renderPlan(plan) {
                return (
                  <SubscriptionPlanCard
                    key={plan._id}
                    plan={plan}
                    onSelect={selectPlan}
                  />
                );
              },
            )}
          </div>
        </section>

        <section className="subscription-history" id="payment-history">
          <div className="page-heading">
            <span className="eyebrow">Payment records</span>
            <h2>Payment history</h2>
          </div>

          {state.payments.length === 0 && (
            <div className="empty-state">No payments yet.</div>
          )}

          {state.payments.map(
            /**
             * Converts one payment record into a history row.
             * @param {object} payment - Family-owned payment.
             * @returns {import("react").ReactElement} Payment row.
             * @sideEffects None.
             */
            function renderPayment(payment) {
              return <PaymentHistoryRow key={payment._id} payment={payment} />;
            },
          )}

          {state.paymentPagination && (
            <Pagination
              page={state.paymentPagination.page}
              pages={state.paymentPagination.pages}
              total={state.paymentPagination.total}
              label="payments"
              disabled={state.loading}
              onPageChange={setPaymentPage}
            />
          )}
        </section>
      </div>

      <SubscriptionCheckoutModal
        checkout={checkout}
        stripeEnabled={stripeEnabled}
        paymentMethod={paymentMethod}
        busy={busy}
        onPaymentMethodChange={changePaymentMethod}
        onClose={closeCheckout}
        onBeginPrototype={beginPrototypeCheckout}
        onBeginStripe={beginStripeCheckout}
        onFinishPrototype={finishPrototypeCheckout}
      />
    </main>
  );
}
