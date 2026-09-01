# Frontend Copy-Paste Guide for ProbashiCare Live Modifications

Use this file when the question changes React pages, components, routes, forms, context, frontend services, loading states, or navigation.

Do not paste a complete block blindly. First find the closest existing page and preserve its shared components, route conventions, CSS classes, and API response shape.

## Requirement-to-section map

| Requirement | Section |
| --- | --- |
| Add a button or link | 2 and 11 |
| Load and display data | 3, 4, and 5 |
| Add or edit a form | 6, 7, and 8 |
| Add loading and disabled behavior | 4 and 8 |
| Add a modal | 9 |
| Add filtering or pagination | 10 |
| Add a route or navigation item | 11 |
| Use authenticated/shared state | 12 |
| Add notification polling | 13 and 16 |
| Gate a Premium feature | 14 |
| Modify elderly profiles | 15 |
| Modify Gemini wellness UI | 17 |
| Acknowledge or resolve wellness alerts | 24 |
| Modify subscription/payment UI | 18 and 19 |
| Show Admin payment analytics/history | 25 |
| Modify Family account/email | 20 |
| Verify email or reset password | 26 |
| Use Copilot safely | 22 |
| Verify changes | 23 |

## 1. Trace before copying

Write this path first:

~~~text
Route URL
  -> React page/component
  -> frontend service method
  -> backend method and URL
  -> response.data.data fields
~~~

Search:

~~~powershell
rg -n "Visible page text" frontend/src
rg -n "serviceMethodName|api-path-part" frontend/src backend/routes
~~~

## 2. Button and asynchronous handler

Simple navigation button:

~~~jsx
/**
 * Opens the elderly-profile creation page.
 * @returns {void} This function returns no value.
 * @sideEffects Changes the React Router location.
 */
function handleAddProfile() {
  navigate("/elderly-profiles/create");
}

<Button
  type="button"
  onClick={handleAddProfile}
>
  Add elderly profile
</Button>
~~~

Asynchronous action:

~~~jsx
/**
 * Marks one notification as read.
 * @param {string} notificationId - Notification identifier.
 * @returns {Promise<void>} Resolves after the request finishes.
 * @sideEffects Calls the API and updates React state.
 */
async function handleMarkRead(notificationId) {
  setActionId(notificationId);
  setError("");

  try {
    const data = await notificationService.markAsRead(notificationId);

    setNotifications((currentNotifications) => {
      return currentNotifications.map((notification) => {
        if (notification._id === notificationId) {
          return data.notification;
        }

        return notification;
      });
    });
  } catch (requestError) {
    const normalizedError = normalizeApiError(requestError);
    setError(normalizedError.message);
  } finally {
    setActionId("");
  }
}
~~~

~~~jsx
<Button
  type="button"
  disabled={actionId === notification._id}
  aria-busy={actionId === notification._id}
  onClick={() => {
    handleMarkRead(notification._id);
  }}
>
  {actionId === notification._id ? "Saving..." : "Mark as read"}
</Button>
~~~

Always change the handler, text, service call, and state fields. Keep duplicate-action protection and error handling.

## 3. Frontend API service

ProbashiCare uses the Axios instance from frontend/src/services/api.js. It sends the cookie and returns useful results under response.data.data.

~~~js
import { api } from "./api.js";

async function listRecords(options = {}) {
  const response = await api.get(
    "/examples",
    {
      params: options,
    },
  );

  return response.data.data;
}

async function getRecord(recordId) {
  const path = "/examples/" + recordId;
  const response = await api.get(path);

  return response.data.data;
}

async function createRecord(payload) {
  const response = await api.post(
    "/examples",
    payload,
  );

  return response.data.data;
}

async function replaceRecord(recordId, payload) {
  const path = "/examples/" + recordId;
  const response = await api.put(
    path,
    payload,
  );

  return response.data.data;
}

async function updateStatus(recordId, status) {
  const path = "/examples/" + recordId + "/status";
  const requestBody = {
    status,
  };

  const response = await api.patch(
    path,
    requestBody,
  );

  return response.data.data;
}

async function deleteRecord(recordId) {
  const path = "/examples/" + recordId;
  const response = await api.delete(path);

  return response.data.data;
}

export const exampleService = {
  listRecords,
  getRecord,
  createRecord,
  replaceRecord,
  updateStatus,
  deleteRecord,
};
~~~

Use archive rather than DELETE when history matters. Never add api at the start of these paths because the shared Axios base URL already ends with api.

## 4. Complete loading, error, empty, and data states

~~~jsx
if (loading) {
  return <PageLoader message="Loading records..." />;
}

if (error) {
  return (
    <section role="alert">
      <p>{error}</p>
      <Button
        type="button"
        onClick={loadRecords}
      >
        Try again
      </Button>
    </section>
  );
}

if (records.length === 0) {
  return (
    <EmptyState
      title="No records yet"
      description="New records will appear here."
    />
  );
}

return (
  <section>
    {records.map((record) => {
      return (
        <RecordCard
          key={record._id}
          record={record}
        />
      );
    })}
  </section>
);
~~~

The map method creates one element per record. Use MongoDB _id as the stable React key.

## 5. Correct asynchronous effect

Never pass an async function directly to useEffect.

~~~jsx
useEffect(() => {
  let ignoreResult = false;

  async function loadRecord() {
    setLoading(true);
    setError("");

    try {
      const data = await exampleService.getRecord(recordId);

      if (!ignoreResult) {
        setRecord(data.record);
      }
    } catch (requestError) {
      if (!ignoreResult) {
        const normalizedError = normalizeApiError(requestError);
        setError(normalizedError.message);
      }
    } finally {
      if (!ignoreResult) {
        setLoading(false);
      }
    }
  }

  loadRecord();

  return function ignoreLateResult() {
    ignoreResult = true;
  };
}, [recordId]);
~~~

Include every prop, route parameter, or state value read by the effect. Cleanup prevents an older request from updating an unmounted or changed page.

## 6. Controlled form

~~~jsx
const [form, setForm] = useState({
  name: "",
  relationship: "",
});

function handleChange(event) {
  const fieldName = event.target.name;
  const fieldValue = event.target.value;

  setForm((currentForm) => {
    return {
      ...currentForm,
      [fieldName]: fieldValue,
    };
  });
}
~~~

~~~jsx
<label htmlFor="profile-name">
  Name
</label>
<Input
  id="profile-name"
  name="name"
  value={form.name}
  onChange={handleChange}
/>

<label htmlFor="relationship">
  Relationship
</label>
<select
  id="relationship"
  name="relationship"
  value={form.relationship}
  onChange={handleChange}
>
  <option value="">Select relationship</option>
  <option value="parent">Parent</option>
  <option value="grandparent">Grandparent</option>
  <option value="other">Other</option>
</select>
~~~

The computed property [fieldName] updates the property matching the input name.

## 7. Nested elderly-profile fields and arrays

Nested object:

~~~jsx
function handlePersonalChange(event) {
  const fieldName = event.target.name;
  const fieldValue = event.target.value;

  setForm((currentForm) => {
    return {
      ...currentForm,
      personalInformation: {
        ...currentForm.personalInformation,
        [fieldName]: fieldValue,
      },
    };
  });
}
~~~

Add an embedded medication:

~~~jsx
function addMedication() {
  const emptyMedication = {
    name: "",
    dosage: "",
    schedule: "",
  };

  setForm((currentForm) => {
    return {
      ...currentForm,
      medications: [
        ...currentForm.medications,
        emptyMedication,
      ],
    };
  });
}
~~~

Update one item:

~~~jsx
function updateMedication(index, fieldName, fieldValue) {
  setForm((currentForm) => {
    const updatedMedications = currentForm.medications.map(
      (medication, medicationIndex) => {
        if (medicationIndex === index) {
          return {
            ...medication,
            [fieldName]: fieldValue,
          };
        }

        return medication;
      },
    );

    return {
      ...currentForm,
      medications: updatedMedications,
    };
  });
}
~~~

Remove one item:

~~~jsx
function removeMedication(indexToRemove) {
  setForm((currentForm) => {
    const remainingMedications = currentForm.medications.filter(
      (_medication, medicationIndex) => {
        return medicationIndex !== indexToRemove;
      },
    );

    return {
      ...currentForm,
      medications: remainingMedications,
    };
  });
}
~~~

map returns a new transformed array. filter returns a new array containing only items whose callback returns true. Do not mutate the existing React state array.

## 8. Validate and submit a form

~~~jsx
const [fieldErrors, setFieldErrors] = useState({});
const [submitting, setSubmitting] = useState(false);
const [error, setError] = useState("");

function validateForm() {
  const errors = {};

  if (!form.name.trim()) {
    errors.name = "Name is required.";
  }

  if (!form.relationship) {
    errors.relationship = "Select a relationship.";
  }

  setFieldErrors(errors);

  return Object.keys(errors).length === 0;
}

async function handleSubmit(event) {
  event.preventDefault();

  if (!validateForm()) {
    return;
  }

  setSubmitting(true);
  setError("");

  try {
    const data = await exampleService.createRecord(form);
    navigate("/examples/" + data.record._id);
  } catch (requestError) {
    const normalizedError = normalizeApiError(requestError);

    setError(normalizedError.message);
    setFieldErrors(normalizedError.details || {});
  } finally {
    setSubmitting(false);
  }
}
~~~

~~~jsx
<Button
  type="submit"
  disabled={submitting}
  aria-busy={submitting}
>
  {submitting ? "Saving..." : "Save"}
</Button>
~~~

Frontend validation improves feedback. Backend validation remains mandatory.

## 9. Controlled modal

~~~jsx
const [selectedRecord, setSelectedRecord] = useState(null);
const [modalError, setModalError] = useState("");

function openModal(record) {
  setSelectedRecord(record);
  setModalError("");
}

function closeModal() {
  if (submitting) {
    return;
  }

  setSelectedRecord(null);
  setModalError("");
}

{selectedRecord ? (
  <Modal
    isOpen={true}
    title="Confirm update"
    onClose={closeModal}
  >
    <p>Update {selectedRecord.name}?</p>

    <Button
      type="button"
      disabled={submitting}
      onClick={handleConfirm}
    >
      {submitting ? "Updating..." : "Confirm"}
    </Button>
  </Modal>
) : null}
~~~

Clear modal state when opening and closing. Do not allow a second confirmation while the first request is running.

## 10. Search, filter, and pagination

~~~jsx
const [filters, setFilters] = useState({
  page: 1,
  status: "all",
  search: "",
});

function changeStatus(event) {
  const nextStatus = event.target.value;

  setFilters((currentFilters) => {
    return {
      ...currentFilters,
      page: 1,
      status: nextStatus,
    };
  });
}

function changePage(nextPage) {
  setFilters((currentFilters) => {
    return {
      ...currentFilters,
      page: nextPage,
    };
  });
}
~~~

~~~jsx
useEffect(() => {
  let ignoreResult = false;

  async function loadRecords() {
    try {
      const data = await exampleService.listRecords(filters);

      if (!ignoreResult) {
        setRecords(data.records);
        setPagination(data.pagination);
      }
    } catch (requestError) {
      if (!ignoreResult) {
        setError(normalizeApiError(requestError).message);
      }
    }
  }

  loadRecords();

  return function cleanup() {
    ignoreResult = true;
  };
}, [filters.page, filters.status, filters.search]);
~~~

~~~jsx
<Pagination
  page={pagination.page}
  pages={pagination.pages}
  total={pagination.total}
  label="records"
  onPageChange={changePage}
/>
~~~

Reset page to 1 when filters change.

## 11. Route and navigation

Route:

~~~jsx
<Route
  path="/examples"
  element={
    <ProtectedRoute allowedRoles={["family"]}>
      <ExampleListPage />
    </ProtectedRoute>
  }
/>
~~~

Navigation:

~~~jsx
<NavLink
  to="/examples"
  className={getNavigationClassName}
>
  Examples
</NavLink>
~~~

Preserve existing login redirects and role behavior unless the question explicitly changes them.

## 12. Auth and shared context

~~~jsx
import { useAuth } from "../context/AuthContext.jsx";

function AccountSummary() {
  const {
    user,
    loading,
    refreshCurrentUser,
  } = useAuth();

  if (loading) {
    return <PageLoader message="Loading account..." />;
  }

  return <p>Signed in as {user.name}</p>;
}
~~~

A custom hook returns the value supplied by its Provider. Inspect the Provider before assuming field names.

Load independent data together:

~~~jsx
const results = await Promise.all([
  elderlyProfileService.listProfiles("active"),
  subscriptionService.getMySubscription(),
]);

setProfiles(results[0].profiles);
setAccess(results[1].access);
~~~

Promise.all preserves input order but rejects if either Promise rejects.

## 13. Context polling

~~~jsx
const refreshUnreadCount = useCallback(async function refreshUnreadCount() {
  const data = await notificationService.getUnreadCount();
  setUnreadCount(data.unreadCount);
}, []);

useEffect(() => {
  if (!user) {
    setNotifications([]);
    setUnreadCount(0);
    return undefined;
  }

  refreshUnreadCount();

  const intervalId = window.setInterval(() => {
    refreshUnreadCount();
  }, 15000);

  return function stopPolling() {
    window.clearInterval(intervalId);
  };
}, [user, refreshUnreadCount]);
~~~

Always clear an interval during cleanup.

## 14. Premium feature gate

Frontend gating is presentation only. The backend must enforce the entitlement.

~~~jsx
function PremiumPage() {
  const location = useLocation();
  const {
    loading,
    hasPremiumAccess,
  } = useSubscription();

  if (loading) {
    return <PageLoader message="Checking Premium access..." />;
  }

  if (!hasPremiumAccess) {
    return (
      <Navigate
        to="/subscription"
        replace
        state={{
          from: location.pathname,
          reason: "premium-required",
        }}
      />
    );
  }

  return <PremiumContent />;
}
~~~

Upgrade card:

~~~jsx
<section className="premium-upgrade-card">
  <p>Premium feature</p>
  <h2>Unlock wellness insights</h2>
  <p>Start a trial or choose a plan.</p>
  <Link to="/subscription">
    View Premium plans
  </Link>
</section>
~~~

## 15. Elderly-profile calls

~~~jsx
const listData =
  await elderlyProfileService.listProfiles("active");

const createData =
  await elderlyProfileService.createProfile(form);

const updateData =
  await elderlyProfileService.updateSection(
    profileId,
    "medications",
    form.medications,
  );

await elderlyProfileService.archiveProfile(profileId);
~~~

Valid section names must match backend routes and validation. Do not invent API names from visible labels.

## 16. Notification calls

~~~jsx
const data = await notificationService.listNotifications({
  page,
  limit: 3,
  unread: filter === "unread",
});

setNotifications(data.notifications);
setUnreadCount(data.unreadCount);
setPagination(data.pagination);
~~~

Mark all read:

~~~jsx
async function handleMarkAllRead() {
  setMarkingAll(true);

  try {
    await notificationService.markAllAsRead();

    setNotifications((currentNotifications) => {
      return currentNotifications.map((notification) => {
        return {
          ...notification,
          readAt:
            notification.readAt ||
            new Date().toISOString(),
        };
      });
    });

    setUnreadCount(0);
  } catch (requestError) {
    setError(normalizeApiError(requestError).message);
  } finally {
    setMarkingAll(false);
  }
}
~~~

Use the existing getNotificationPath helper for internal navigation.

## 17. Gemini wellness UI

~~~jsx
async function handleGenerateInsight() {
  setGenerating(true);
  setError("");

  try {
    const data =
      await wellnessInsightService.generateInsight(profileId);

    setInsight(data.insight);

    if (data.insight.source === "fallback") {
      setMessage(
        "Gemini was unavailable. A rule-based summary was created.",
      );
    } else {
      setMessage("Wellness summary generated.");
    }
  } catch (requestError) {
    const normalizedError = normalizeApiError(requestError);

    if (normalizedError.status === 403) {
      navigate("/subscription", {
        state: {
          reason: "premium-required",
        },
      });
      return;
    }

    setError(normalizedError.message);
  } finally {
    setGenerating(false);
  }
}
~~~

Never label fallback output as Gemini-generated.

## 18. Subscription and payment UI

Load plans, access, and history:

~~~jsx
const results = await Promise.all([
  subscriptionService.listPlans(),
  subscriptionService.getMySubscription(),
  subscriptionService.listPayments({
    page,
    limit: 3,
  }),
]);

setPlans(results[0].plans);
setPaymentOptions(results[0].paymentOptions);
setSubscription(results[1].subscription);
setAccess(results[1].access);
setPayments(results[2].payments);
setPagination(results[2].pagination);
~~~

Create prototype payment:

~~~jsx
const payment = await subscriptionService.purchase({
  planCode,
  paymentMethod,
});

setPendingPayment(payment);
~~~

Do not send amount, currency, duration, or entitlements from React.

Start Stripe Checkout:

~~~jsx
async function beginStripeCheckout(planCode) {
  setSubmitting(true);

  try {
    const data =
      await subscriptionService.createStripeCheckout(planCode);

    window.location.assign(data.checkoutUrl);
  } catch (requestError) {
    setError(normalizeApiError(requestError).message);
    setSubmitting(false);
  }
}
~~~

## 19. Bounded Stripe return polling

~~~jsx
async function waitForStripeResult(sessionId) {
  const maximumAttempts = 10;
  const delayMilliseconds = 1500;

  for (
    let attemptNumber = 1;
    attemptNumber <= maximumAttempts;
    attemptNumber += 1
  ) {
    const payment =
      await subscriptionService.getStripeCheckoutStatus(sessionId);

    if (payment.status !== "pending") {
      return payment;
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, delayMilliseconds);
    });
  }

  return null;
}
~~~

The bounded loop cannot poll forever. The verified webhook remains the payment authority.

## 20. Family account and email re-verification

~~~jsx
const emailChanged =
  form.email.trim().toLowerCase() !==
  user.email.toLowerCase();

async function handleAccountSubmit(event) {
  event.preventDefault();
  setSubmitting(true);
  setError("");

  try {
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
    };

    if (emailChanged) {
      payload.currentPassword = form.currentPassword;
    }

    const data =
      await authService.updateFamilyAccount(payload);

    if (data.requiresEmailVerification) {
      await logout();

      navigate("/login", {
        replace: true,
        state: {
          message: data.message,
        },
      });

      return;
    }

    await refreshCurrentUser();
    setMessage(data.message);
  } catch (requestError) {
    const normalizedError = normalizeApiError(requestError);
    setError(normalizedError.message);
    setFieldErrors(normalizedError.details || {});
  } finally {
    setSubmitting(false);
  }
}
~~~

Only request the current password when the normalized email changes. Force logout after an email change requiring verification.

## 21. Accessibility checklist

- Use real buttons, links, inputs, and selects.
- Connect label htmlFor to input id.
- Add aria-label to icon-only buttons.
- Add aria-busy during a long action.
- Use role="alert" for important errors.
- Do not use color as the only status indicator.
- Keep focus visible.
- Disable duplicate submissions.

## 22. Copilot comment-first prompts

Write one precise comment and accept only a small, explainable suggestion:

~~~js
// Load page 1 of caller-owned unread notifications and save pagination.
~~~

~~~js
// Submit the elderly profile form, normalize API errors,
// and navigate to the created profile after success.
~~~

~~~js
// Redirect a Core user to the subscription page while preserving this path.
~~~

~~~js
// Poll Stripe status at most ten times and stop at a terminal status.
~~~

~~~js
// Update Family account details and force logout only after an email change.
~~~

Verify every Copilot suggestion:

1. Import path.
2. Existing function name.
3. Endpoint and HTTP method.
4. Request fields.
5. response.data.data fields.
6. State setters.
7. Effect dependencies.
8. Loading cleanup.
9. Role and Premium assumptions.

## 23. Frontend verification

~~~powershell
npm.cmd run build --prefix frontend
git diff --check
git status --short
~~~

Manual checks:

- Open and refresh the changed route.
- Test loading, empty, success, and error UI.
- Try a double click and confirm duplicate actions are blocked.
- Test the relevant roles.
- Test Core, trial, Premium, and expired access when relevant.
- Inspect browser Console and Network tabs.
- Confirm authentication redirects still work.

## 24. Wellness-alert acknowledge and resolve

Acknowledge:

~~~jsx
async function handleAcknowledge(alertId) {
  setActionId(alertId);
  setError("");

  try {
    const data =
      await wellnessAlertService.acknowledgeAlert(alertId);

    replaceAlertInState(data.alert);
  } catch (requestError) {
    setError(
      normalizeApiError(requestError).message,
    );
  } finally {
    setActionId("");
  }
}
~~~

Resolve with a controlled note:

~~~jsx
async function handleResolve(event) {
  event.preventDefault();

  if (!selectedAlert) {
    return;
  }

  setSubmitting(true);

  try {
    const data =
      await wellnessAlertService.resolveAlert(
        selectedAlert._id,
        {
          resolutionNote:
            resolutionNote.trim(),
        },
      );

    replaceAlertInState(data.alert);
    setSelectedAlert(null);
    setResolutionNote("");
  } catch (requestError) {
    setError(
      normalizeApiError(requestError).message,
    );
  } finally {
    setSubmitting(false);
  }
}
~~~

Update totals or reload the active page after a status transition. Do not make the frontend invent severity; the backend analysis creates it.

## 25. Admin payment history and analytics

Service:

~~~js
async function listAdminPayments(options = {}) {
  const response = await api.get(
    "/admin/subscriptions/payments",
    {
      params: options,
    },
  );

  return response.data.data;
}

async function getSubscriptionAnalytics() {
  const response = await api.get(
    "/admin/subscriptions/analytics",
  );

  return response.data.data;
}
~~~

Page load:

~~~jsx
const results = await Promise.all([
  adminService.getSubscriptionAnalytics(),
  adminService.listSubscriptionPayments({
    page,
    limit: 3,
    status,
    search,
  }),
]);

setAnalytics(results[0]);
setPayments(results[1].payments);
setPagination(results[1].pagination);
~~~

Reset page to 1 when status/search changes. Protect the route for Admin and never display secret provider data.

## 26. Verify email, forgot password, and reset password

Read a token from the URL and verify once:

~~~jsx
const [searchParams] = useSearchParams();
const token = searchParams.get("token") || "";

useEffect(() => {
  let ignoreResult = false;

  async function verify() {
    if (!token) {
      setError("Verification token is missing.");
      setLoading(false);
      return;
    }

    try {
      const data =
        await authService.verifyEmail(token);

      if (!ignoreResult) {
        setMessage(data.message);
      }
    } catch (requestError) {
      if (!ignoreResult) {
        setError(
          normalizeApiError(requestError).message,
        );
      }
    } finally {
      if (!ignoreResult) {
        setLoading(false);
      }
    }
  }

  verify();

  return function cleanup() {
    ignoreResult = true;
  };
}, [token]);
~~~

Forgot-password submit:

~~~jsx
async function handleForgotPassword(event) {
  event.preventDefault();
  setSubmitting(true);

  try {
    const data =
      await authService.forgotPassword(
        email.trim(),
      );

    setMessage(data.message);
  } catch (requestError) {
    setError(
      normalizeApiError(requestError).message,
    );
  } finally {
    setSubmitting(false);
  }
}
~~~

Reset-password submit:

~~~jsx
async function handleResetPassword(event) {
  event.preventDefault();

  if (password !== confirmPassword) {
    setError("Passwords do not match.");
    return;
  }

  setSubmitting(true);

  try {
    const data =
      await authService.resetPassword({
        token,
        password,
        confirmPassword,
      });

    navigate("/login", {
      replace: true,
      state: {
        message: data.message,
      },
    });
  } catch (requestError) {
    setError(
      normalizeApiError(requestError).message,
    );
  } finally {
    setSubmitting(false);
  }
}
~~~

Keep backend responses neutral for forgot-password and resend requests.

## Final explanation

"I changed the React page or component. It stores input and request state with useState, calls the existing frontend service, and reads response.data.data. It handles loading, error, empty, and success states. The service method and URL match the Express route. I preserved role and Premium behavior, blocked duplicate actions, and verified the frontend build."
