# Frontend Function Flow and React Execution Sequence

This guide answers one question:

> In a React page with state, effects, event handlers, and API calls, what executes first and what causes the next step?

## The most important sequence

For a page that loads backend data:

~~~text
React calls component
→ component reads hooks and calculates display values
→ component returns JSX
→ browser displays JSX
→ useEffect runs
→ effect calls async loading function
→ frontend service sends request
→ backend responds
→ state setter stores result
→ React calls component again
→ JSX renders the new state
~~~

For a user action:

~~~text
User clicks/types/submits
→ named event handler runs
→ handler validates or builds payload
→ frontend service sends request
→ handler awaits response
→ state/context is updated
→ React renders again
→ user sees success, error, or changed data
~~~

The exam mnemonic is:

~~~text
Render → Effect/Event → Service → API → State → Re-render
~~~

## A component function does not run only once

A React component runs from top to bottom every time React renders it:

~~~javascript
export function RecordsPage() {
  // Step 1: Hooks return state retained from the previous render.
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // Step 2: Display values are calculated for this render.
  const recordCount = records.length;

  // Step 3: Effects are registered. Their callback runs after rendering.
  useEffect(
    function loadOnFirstRender() {
      // This callback does not run during the JSX calculation.
    },
    [],
  );

  // Step 4: React receives the JSX for this render.
  return (
    <div>
      <p>{recordCount} records</p>
      {loading && <span>Loading</span>}
    </div>
  );
}
~~~

When setRecords or setLoading is called, React schedules another render. The function starts again, but useState returns the new stored value.

## Number the intentions inside a page

Before writing a larger component, use this order:

~~~javascript
export function ExamplePage() {
  // Section 1: Read route, context, and shared hooks.

  // Section 2: Declare local state.

  // Section 3: Load API data in effects.

  // Section 4: Define named event handlers.

  // Section 5: Calculate display-only values.

  // Section 6: Return loading or error UI.

  // Section 7: Return the main JSX.
}
~~~

Inside a large event handler, number its execution:

~~~javascript
async function submitForm(event) {
  // Step 1: Stop the browser's default form submission.

  // Step 2: Validate local input.

  // Step 3: Build the API request body.

  // Step 4: Start loading state.

  // Step 5: Call and await the frontend service.

  // Step 6: Update state or navigate after success.

  // Step 7: Normalize and show any error.

  // Step 8: End loading state.
}
~~~

## Complete data-loading page with visible sequence

~~~javascript
/**
 * Displays caller-authorized records from the API.
 *
 * @returns {import("react").ReactElement} Record list page.
 * @sideEffects Loads records after rendering.
 */
export function RecordsPage() {
  // Section 1: Read route and shared context.
  const { profileId } = useParams();

  // Section 2: Store every visible request state explicitly.
  const [state, setState] = useState({
    loading: true,
    records: [],
    error: "",
  });

  // Section 3: Register data loading for profile changes.
  useEffect(
    function loadWhenProfileChanges() {
      let ignoreResult = false;

      /**
       * Loads records for the selected profile.
       *
       * @returns {Promise<void>} Resolves after state is updated.
       * @sideEffects Sends an API request and updates local state.
       */
      async function loadRecords() {
        // Step 1: Show loading and clear an old error.
        setState({
          loading: true,
          records: [],
          error: "",
        });

        try {
          // Step 2: The service sends the HTTP request.
          const data = await exampleService.listRecords(profileId);

          // Step 3: Ignore a late response after cleanup.
          if (ignoreResult) {
            return;
          }

          // Step 4: Store successful data.
          setState({
            loading: false,
            records: data.records,
            error: "",
          });
        } catch (error) {
          if (ignoreResult) {
            return;
          }

          // Step 5: Convert Axios/backend errors into one safe UI message.
          const normalizedError = normalizeApiError(error);

          setState({
            loading: false,
            records: [],
            error: normalizedError.message,
          });
        }
      }

      // Step 6: Start the async function without returning its Promise to React.
      void loadRecords();

      /**
       * Prevents an old request from updating an unmounted/stale page.
       *
       * @returns {void}
       * @sideEffects Changes the closure flag.
       */
      function cleanup() {
        ignoreResult = true;
      }

      // Step 7: React calls cleanup before unmount or before rerunning the effect.
      return cleanup;
    },
    [profileId],
  );

  // Section 4: End the current render early for loading.
  if (state.loading) {
    return (
      <main>
        <div className="page-loader">
          <span className="spinner" />
          Loading records
        </div>
      </main>
    );
  }

  // Section 5: End the current render early for an error.
  if (state.error) {
    return (
      <main>
        <div className="alert alert--error">
          {state.error}
        </div>
      </main>
    );
  }

  // Section 6: Return the successful UI.
  return (
    <main>
      <h1>Records</h1>

      {state.records.length === 0 && (
        <p>No records yet.</p>
      )}

      {state.records.map(
        function renderRecord(record) {
          return (
            <article key={record._id}>
              <h2>{record.title}</h2>
            </article>
          );
        },
      )}
    </main>
  );
}
~~~

## What useEffect actually does

useEffect registers work that should happen after React commits a render.

~~~javascript
useEffect(
  function runAfterProfileChanges() {
    void loadProfile();
  },
  [profileId],
);
~~~

Sequence:

~~~text
1. Component renders using current state
2. Browser displays that result
3. Effect callback runs
4. loadProfile sends request
5. state setter receives data
6. component renders again
~~~

Dependency meanings:

| Dependency array | Effect timing |
| --- | --- |
| omitted | after every render |
| empty array | after first mounted render |
| profileId | after first render and whenever profileId changes |
| page, filter | whenever page or filter changes |

Do not make the effect callback itself async:

~~~javascript
// Avoid this.
useEffect(async function loadData() {
  await service.load();
}, []);
~~~

Instead define or call an async function inside the effect, because React expects the effect to return only undefined or a cleanup function.

## Frontend service flow

A frontend service should know the HTTP method, endpoint, request body, and response shape. It should not manage JSX or component state.

~~~javascript
/**
 * Loads records for one authorized elderly profile.
 *
 * @param {string} profileId - Elderly profile identifier.
 * @returns {Promise<{records: object[]}>} Authorized records.
 * @sideEffects Sends an authenticated HTTP request.
 */
async function listRecords(profileId) {
  // Step 1: Build the exact route used by the backend.
  const endpoint =
    "/elderly-profiles/" + profileId + "/records";

  // Step 2: Await the shared Axios client.
  const response = await api.get(endpoint);

  // Step 3: Extract the agreed success payload.
  const responseData = response.data.data;

  // Step 4: Return data to the page that called this function.
  return responseData;
}
~~~

The service Promise resolves in the page at:

~~~javascript
const data = await exampleService.listRecords(profileId);
~~~

After that line, data is the object returned by the service.

## Form state and input-handler flow

~~~javascript
export function ExampleForm() {
  const [form, setForm] = useState({
    title: "",
    priority: "medium",
  });

  /**
   * Updates the field that emitted the change event.
   */
  function handleChange(event) {
    // Step 1: Read the HTML input name and value.
    const fieldName = event.target.name;
    const fieldValue = event.target.value;

    // Step 2: Ask React to calculate the next state from current state.
    setForm(
      function updateChangedField(currentForm) {
        // Step 3: Copy every unchanged field.
        const nextForm = {
          ...currentForm,
        };

        // Step 4: Bracket notation updates the field named by fieldName.
        nextForm[fieldName] = fieldValue;

        // Step 5: Return the state React should store.
        return nextForm;
      },
    );
  }

  return (
    <input
      name="title"
      value={form.title}
      onChange={handleChange}
    />
  );
}
~~~

Sequence after typing:

~~~text
Browser creates change event
→ handleChange reads name/value
→ setForm callback receives latest state
→ callback returns next state
→ React renders component again
→ input receives the new form.title value
~~~

## Complete submit-handler flow

~~~javascript
/**
 * Creates a record from the current form.
 *
 * @param {import("react").FormEvent} event - Form submission event.
 * @returns {Promise<void>} Resolves after success or handled failure.
 * @sideEffects Sends an API request, updates state, and may navigate.
 */
async function handleSubmit(event) {
  // Step 1: Prevent a full browser page refresh.
  event.preventDefault();

  // Step 2: Perform quick client validation for immediate feedback.
  const cleanTitle = form.title.trim();

  if (!cleanTitle) {
    setError("Title is required.");
    return;
  }

  // Step 3: Build only the fields accepted by the API.
  const requestBody = {
    elderlyProfileId: profileId,
    title: cleanTitle,
    priority: form.priority,
  };

  // Step 4: Enter loading state and clear the old error.
  setSubmitting(true);
  setError("");

  try {
    // Step 5: Wait for the frontend service and backend controller.
    const data = await exampleService.createRecord(requestBody);

    // Step 6: Show success and navigate using the returned record.
    showToast("Record created successfully.", "success");
    navigate("/records/" + data.record._id);
  } catch (error) {
    // Step 7: Display one normalized backend/network message.
    const normalizedError = normalizeApiError(error);
    setError(normalizedError.message);
  } finally {
    // Step 8: This runs after success or failure.
    setSubmitting(false);
  }
}
~~~

The return inside validation ends the handler before any request is sent.

## Button-handler flow

A button does not execute its handler during render:

~~~javascript
<Button onClick={markAllAsRead}>
  Mark all as read
</Button>
~~~

React stores the function reference. It calls markAllAsRead later when the user clicks.

Correct:

~~~javascript
onClick={markAllAsRead}
~~~

Different behavior:

~~~javascript
onClick={markAllAsRead()}
~~~

The second version calls the function immediately while rendering and passes its return value to onClick.

When a handler needs an item:

~~~javascript
function handleReadClick() {
  void markAsRead(notification._id);
}

<Button onClick={handleReadClick}>
  Mark as read
</Button>
~~~

Inside a list, a small arrow wrapper is also normal:

~~~javascript
<Button onClick={() => markAsRead(notification._id)}>
  Mark as read
</Button>
~~~

The wrapper runs on click and then calls markAsRead with the correct ID.

## State setters are scheduled, not immediate variable assignment

~~~javascript
setCount(count + 1);

// count may still be the old value on this same execution line.
~~~

When the next state depends on the previous state, use the callback form:

~~~javascript
setCount(
  function increaseCount(currentCount) {
    return currentCount + 1;
  },
);
~~~

For objects:

~~~javascript
setState(
  function preserveDataAndStopLoading(currentState) {
    return {
      ...currentState,
      loading: false,
    };
  },
);
~~~

The spread operator copies the other fields so they are not lost.

## Conditional-render flow

Prefer readable early returns for whole-page states:

~~~javascript
if (loading) {
  return <PageLoader />;
}

if (error) {
  return <ErrorState message={error} />;
}

return <SuccessfulPage />;
~~~

For a small JSX section:

~~~javascript
{records.length === 0 && (
  <EmptyState />
)}
~~~

For two clearly different choices, calculate the JSX or value first:

~~~javascript
let actionLabel = "Create record";

if (isEditing) {
  actionLabel = "Save changes";
}

return (
  <Button>
    {actionLabel}
  </Button>
);
~~~

This is easier to explain than deeply nested ternaries.

## Context-provider flow

A context provider centralizes state used by several components:

~~~javascript
export function NotificationProvider({ children }) {
  // Step 1: Store shared notification state.
  const [unreadCount, setUnreadCount] = useState(0);

  /**
   * Refreshes the unread count from the backend.
   */
  async function refreshUnreadCount() {
    // Step 2: Ask the service for current data.
    const count = await notificationService.getUnreadCount();

    // Step 3: Store it; every consumer may render again.
    setUnreadCount(count);

    // Step 4: Return it for callers that also need the value.
    return count;
  }

  // Step 5: Expose state and actions through one object.
  const contextValue = {
    unreadCount,
    refreshUnreadCount,
  };

  // Step 6: Render children with access to that object.
  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  );
}
~~~

A consumer flow:

~~~javascript
const {
  unreadCount,
  refreshUnreadCount,
} = useNotifications();
~~~

useNotifications returns the same contextValue object created by the nearest NotificationProvider.

## A full request-to-screen sequence

For Mark all notifications as read:

~~~text
1. NotificationBell renders with unreadCount
2. User clicks Mark all as read
3. named click handler starts
4. notificationService.markAllAsRead sends PATCH request
5. Express route runs authentication middleware
6. backend controller updates MongoDB
7. backend sends JSON response
8. frontend handler awaits that response
9. handler sets unreadCount to zero or refreshes context
10. React renders NotificationBell again
11. badge disappears
~~~

For a wellness summary:

~~~text
1. ElderlyWellnessPage renders current saved insight
2. User clicks Generate summary
3. generate handler sets generating state
4. wellnessInsightService sends POST request
5. backend authorizes profile
6. backend reads submitted reports
7. Gemini service runs or fallback is selected
8. backend saves and returns WellnessInsight
9. frontend handler stores returned insight
10. React renders the new summary
11. finally ends generating state
~~~

## Async and concurrent frontend flow

Sequential requests:

~~~javascript
const profileData =
  await elderlyProfileService.getProfile(profileId);

const reportData =
  await wellnessReportService.listElderlyReports(profileId);
~~~

The report request starts after the profile request completes.

Independent requests may run together:

~~~javascript
const results = await Promise.all([
  elderlyProfileService.getProfile(profileId),
  wellnessReportService.listElderlyReports(profileId),
]);

const profileData = results[0];
const reportData = results[1];
~~~

Use Promise.all only when the second request does not require the first result.

## Control-flow rules in frontend functions

| Construct | Effect on execution |
| --- | --- |
| return | Ends the handler or current component render |
| throw | Stops normal flow and moves to catch/error boundary |
| await | Pauses the current async function |
| setState | Schedules state and a future render |
| useEffect | Registers work to run after render |
| cleanup | Runs before effect reruns or component unmounts |
| navigate | Changes the route and usually mounts another page |
| Promise.all | Runs independent Promises concurrently |
| event.preventDefault | Stops the browser's default form action |

## How to trace an existing frontend function

1. Find the visible text, button, or page route.
2. Find the component that renders it.
3. Find the handler passed to onClick, onChange, or onSubmit.
4. Inside the handler, mark every return, await, state setter, and navigate call.
5. Open the frontend service function it calls.
6. Write down the method, URL, body, and returned data.
7. Locate the backend route and controller.
8. Return to the component and identify which state causes the final UI change.

Use this sheet:

~~~text
Component:
What triggers the function:
Input from event/state/params/context:
Early return:
Service called:
HTTP method and URL:
Success state change:
Error state change:
Navigation:
What re-renders:
Visible result:
~~~

## Exam-safe frontend page skeleton

~~~javascript
export function ExamplePage() {
  // Section 1: Read route/context values.
  const { profileId } = useParams();
  const { showToast } = useToast();

  // Section 2: Declare request and UI state.
  const [state, setState] = useState({
    loading: true,
    records: [],
    error: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Section 3: Load initial data.
  useEffect(
    function loadPageData() {
      /**
       * Loads records from the API.
       */
      async function loadRecords() {
        try {
          const data =
            await exampleService.listRecords(profileId);

          setState({
            loading: false,
            records: data.records,
            error: "",
          });
        } catch (error) {
          const normalizedError = normalizeApiError(error);

          setState({
            loading: false,
            records: [],
            error: normalizedError.message,
          });
        }
      }

      void loadRecords();
    },
    [profileId],
  );

  // Section 4: Define user actions.
  async function createRecord(input) {
    setSubmitting(true);

    try {
      const data = await exampleService.createRecord(input);

      setState(
        function appendCreatedRecord(currentState) {
          return {
            ...currentState,
            records: [
              data.record,
              ...currentState.records,
            ],
          };
        },
      );

      showToast("Record created.", "success");
    } catch (error) {
      const normalizedError = normalizeApiError(error);
      showToast(normalizedError.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  // Section 5: Return simple page states.
  if (state.loading) {
    return <div className="page-loader">Loading</div>;
  }

  if (state.error) {
    return <div className="alert alert--error">{state.error}</div>;
  }

  // Section 6: Return the main interface.
  return (
    <main>
      <h1>Records</h1>
      <RecordForm
        isSubmitting={submitting}
        onSubmit={createRecord}
      />
      <RecordList records={state.records} />
    </main>
  );
}
~~~

Before copying it, replace the model nouns, route parameter, service functions, request/response fields, and UI component names with the closest existing feature.