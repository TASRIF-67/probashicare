# React Hooks and Router Hooks: Live-Test Guide

Use this guide when a question mentions state, API loading, URL parameters, filters, navigation, context, references, or performance. Examples follow ProbashiCare patterns.

## Read these first

1. `useState` - remember changing data.
2. `useEffect` - run side effects after rendering, commonly API loading.
3. `useParams` - read a dynamic path value such as `profileId`.
4. `useSearchParams` - handle query filters such as `?page=2`.
5. `useNavigate` - move to another route from JavaScript.
6. `useContext` - read shared auth, notification, or subscription state.
7. `useRef`, `useMemo`, `useCallback`, and `useId` - use for specific purposes.

## Hook map

| Requirement | Hook |
| --- | --- |
| Store an input, API result, or loading flag | `useState` |
| Load data, subscribe, or start a timer | `useEffect` |
| Read `/elderly/:profileId/wellness` | `useParams` |
| Read/change `?page=2&status=active` | `useSearchParams` |
| Redirect after saving | `useNavigate` |
| Inspect current URL or route state | `useLocation` |
| Read shared application state | `useContext` through a custom hook |
| Keep a DOM node or non-rendering value | `useRef` |
| Cache a calculated value | `useMemo` |
| Keep a function reference stable | `useCallback` |
| Create an accessible unique form ID | `useId` |

## Rules of Hooks

1. Call hooks only at the top level of a React component or custom hook.
2. Never call hooks inside conditions, loops, event handlers, or ordinary helpers.

~~~jsx
export function ExamplePage() {
  const [loading, setLoading] = useState(true);
  if (loading) return <p>Loading...</p>;
  return <p>Ready</p>;
}
~~~

React relies on hooks being called in the same order on every render.

## Render sequence

1. React calls the component function.
2. Hooks provide current values.
3. Returned JSX is displayed.
4. `useEffect` runs after the render is committed.
5. An effect can request API data.
6. A setter stores the result and React renders again.

A setter schedules a future render; it does not rewrite the variable in the currently running function.

## How to read compact JavaScript lines

When one line looks difficult, read it from the innermost value outward and rewrite it into several temporary steps.

~~~jsx
const hasPremium = Boolean(subscriptionData?.access?.isPremium);
~~~

Read it as:

1. Start with `subscriptionData`.
2. `?.access` means: read `access` only if `subscriptionData` exists.
3. `?.isPremium` means: read `isPremium` only if `access` exists.
4. If either object is missing, the expression becomes `undefined` instead of throwing an error.
5. `Boolean(...)` converts the final value to exactly `true` or `false`.
6. Store that boolean in `hasPremium`.

The longer beginner-friendly equivalent is:

~~~jsx
let premiumValue;

if (subscriptionData && subscriptionData.access) {
  premiumValue = subscriptionData.access.isPremium;
}

const hasPremium = Boolean(premiumValue);
~~~

Examples: `Boolean(true)` is `true`; `Boolean(undefined)`, `Boolean(null)`, `Boolean(0)`, and `Boolean('')` are `false`.

### Other compact patterns to recognize

~~~jsx
const name = profile?.personalInformation?.name ?? 'Unknown';
~~~

`?.` safely reads nested properties. `??` uses the right side only when the left side is `null` or `undefined`.

~~~jsx
const label = loading ? 'Loading...' : 'Ready';
~~~

This ternary means: if `loading` is true, use the first value; otherwise use the second.

~~~jsx
const { data: subscriptionData, loading } = useSubscription();
~~~

This object destructuring takes `data` and renames it `subscriptionData`, while taking `loading` without renaming it.

~~~jsx
const activeItems = items
  .filter((item) => item.status === 'active')
  .map((item) => item.title);
~~~

Read chained array methods left to right: start with `items`, keep active items, then convert each remaining item into its title.

During the test, expanding a compact line into temporary variables is valid. Make it correct and explainable first; shorten it only if useful.

## `useState`

~~~jsx
const [value, setValue] = useState(initialValue);
~~~

This is array destructuring. `value` is current state, `setValue` schedules the next state, and `initialValue` is used on the first render.

~~~jsx
const [count, setCount] = useState(0);

function increaseCount() {
  setCount((currentCount) => currentCount + 1);
}
~~~

Use the functional form when the next value depends on the previous one.

### Object/form state

~~~jsx
const [form, setForm] = useState({ name: '', relationship: '' });

function handleChange(event) {
  const { name, value } = event.target;
  setForm((current) => ({ ...current, [name]: value }));
}
~~~

`...current` copies unchanged fields. `[name]` is a computed property name.

### Array state

~~~jsx
const [medications, setMedications] = useState([]);

setMedications((items) => [...items, newMedication]);
setMedications((items) => items.filter((item) => item._id !== id));
~~~

Do not mutate state with `push`, `splice`, or direct property assignment. Create a new object or array.

Viva: `useState` stores component data that may change and its setter causes React to render with the new value.

## `useEffect`

Effects synchronize React with something external: API requests, timers, event listeners, or subscriptions.

~~~jsx
useEffect(() => {
  // After every render: no dependency array.
});

useEffect(() => {
  // After first render.
}, []);

useEffect(() => {
  // First render, then when profileId or page changes.
}, [profileId, page]);
~~~

Do not make the effect callback itself `async`; create and call an async function inside it.

~~~jsx
useEffect(() => {
  async function loadReports() {
    setLoading(true);

    try {
      const data = await wellnessService.listReports({ profileId, page });
      setReports(data.reports);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }

  loadReports();
}, [profileId, page]);
~~~

An effect may return cleanup. Cleanup clears timers/listeners or prevents stale requests from updating an old page. Avoid loops where the effect always changes one of its dependencies.

Viva: `useEffect` runs after rendering. Dependencies control reruns; cleanup reverses ongoing work.

## `useParams`

`useParams` reads dynamic route segments.

~~~jsx
<Route path='/elderly/:profileId/wellness' element={<ElderlyWellnessPage />} />

export function ElderlyWellnessPage() {
  const { profileId } = useParams();
}
~~~

For `/elderly/abc123/wellness`, `profileId` is the string `'abc123'`. The braces are object destructuring, and the name must match `:profileId`.

## `useSearchParams`

Search parameters appear after `?` and suit pagination, filters, and tabs.

~~~jsx
const [searchParams, setSearchParams] = useSearchParams();
const page = Number(searchParams.get('page') || 1);
const status = searchParams.get('status') || 'all';

setSearchParams({ page: '1', status: 'unread' });
~~~

Why an array? The hook returns the current `URLSearchParams` object and a setter. Array destructuring names both.

~~~javascript
const query = new URLSearchParams({ page: String(page), status });
api.get(`/notifications?${query.toString()}`);
~~~

The second example uses the browser's native `URLSearchParams` to build an API query.

## `useNavigate` and `useLocation`

Use navigation when an event or condition chooses the destination.

~~~jsx
const navigate = useNavigate();
const location = useLocation();

async function handleSubmit(event) {
  event.preventDefault();
  await elderlyProfileService.create(form);
  navigate('/family/elderly');
}

navigate('/subscription', {
  state: { reason: 'premium-required' },
});
~~~

`location.pathname`, `location.search`, and `location.state` describe the current location. Use `<Link>` for ordinary visible links and `navigate()` for programmatic redirects. Route state is temporary, not permanent storage.

## `createContext`, `useContext`, and custom hooks

Context shares data with descendants without passing props through every level.

~~~jsx
const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  return (
    <NotificationContext.Provider value={{ notifications, setNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}
~~~

~~~jsx
export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('Provider is missing.');
  return context;
}
~~~

The provider creates shared values. `useContext` reads the closest provider. The guarded custom hook gives consumers a clear API and detects missing setup.

ProbashiCare custom hooks include `useAuth`, `useNotifications`, `useSubscription`, `useTheme`, `useToast`, and `useAuthRedirect`.

## `useCallback` and `useMemo`

`useCallback` remembers a function reference. It is useful when that function is an effect dependency or a memoized child prop.

~~~jsx
const loadNotifications = useCallback(async () => {
  const data = await notificationService.list();
  setNotifications(data.notifications);
}, []);

useEffect(() => {
  loadNotifications();
}, [loadNotifications]);
~~~

`useMemo` remembers a calculated value, not a side effect.

~~~jsx
const unreadNotifications = useMemo(
  () => notifications.filter((item) => !item.readAt),
  [notifications],
);
~~~

Viva: `useMemo` caches a value; `useCallback` caches a function reference. Use them for a reason, not automatically.

## `useRef`

`useRef` returns the same object on each render. Changing `.current` does not render again.

~~~jsx
const emailInputRef = useRef(null);

function focusEmail() {
  emailInputRef.current?.focus();
}

return <input ref={emailInputRef} type='email' />;
~~~

Use state when a change must appear on screen. Use a ref for a DOM element or persistent value that does not control rendering.

## `useId`

`useId` creates a stable unique ID, usually for accessibility.

~~~jsx
const emailId = useId();

return (
  <>
    <label htmlFor={emailId}>Email address</label>
    <input id={emailId} type='email' />
  </>
);
~~~

Do not use `useId` for MongoDB IDs or React list keys.

## Custom hooks

A custom hook is a reusable function whose name begins with `use` and may call other hooks. It shares logic, not JSX; a component shares UI.

~~~jsx
function useReports(profileId) {
  const [reports, setReports] = useState([]);

  useEffect(() => {
    wellnessService.listReports({ profileId })
      .then((data) => setReports(data.reports));
  }, [profileId]);

  return reports;
}
~~~

## `useReducer`

Use `useReducer` when one state object has several related actions. It returns the current state and a `dispatch` function.

~~~jsx
const initialState = { loading: false, error: '' };

function reducer(state, action) {
  switch (action.type) {
    case 'start':
      return { loading: true, error: '' };
    case 'fail':
      return { loading: false, error: action.message };
    default:
      return state;
  }
}

const [state, dispatch] = useReducer(reducer, initialState);
dispatch({ type: 'start' });
~~~

Viva: `useState` is simplest for independent values. `useReducer` centralizes transitions for more complex related state.

## Less-common hooks faculty may mention

- `useLayoutEffect`: like `useEffect`, but runs before the browser paints. Reserve it for layout measurement because it can block painting.
- `useTransition`: marks a non-urgent state update so urgent interactions remain responsive. It returns `[isPending, startTransition]`.
- `useDeferredValue`: lets a slow derived view lag behind a rapidly changing value such as search text.
- `useImperativeHandle`: customizes the value exposed through a component ref; uncommon in normal page code.

Do not introduce these merely to make code look advanced. For ProbashiCare live modifications, `useState`, `useEffect`, Router hooks, and context are far more likely.

## Common viva answers

- **Hook:** a React function that gives function components state, effects, context, refs, or routing information.
- **Props versus state:** props come from a parent; state is owned and updated by the component.
- **Does a setter update immediately?** No. It schedules a render; current code still sees its current-render snapshot.
- **Why can an effect run twice in development?** Strict Mode repeats setup/cleanup to expose unsafe effects.
- **State versus ref:** state updates render; changing `ref.current` does not.
- **Params versus search params:** params are named path segments; search params are optional values after `?`.
- **Why does a mapped item need `key`?** React uses a stable key to match items between renders. Prefer a database ID.

## Common mistakes

- Calling hooks conditionally or inside a handler.
- Mutating state instead of making a new object or array.
- Making the effect callback itself `async`.
- Missing an effect dependency or creating an effect loop.
- Forgetting loading, error, empty, and success states.
- Reading a route parameter whose name differs from the route declaration.
- Using context outside its provider.
- Using `useMemo` or `useCallback` everywhere without a reason.

## ProbashiCare files to study

Run these searches:

~~~powershell
rg -n 'useState|useEffect|useParams|useSearchParams|useNavigate|useLocation' frontend/src
rg -n 'useContext|useCallback|useMemo|useRef|useId' frontend/src
rg -n 'export function use[A-Z]' frontend/src
~~~

High-value examples:

- `frontend/src/pages/family/ElderlyWellnessPage.jsx`: params, state, effects, pagination, and Premium data.
- Notification context and bell: context, callbacks, polling, and shared unread state.
- Authentication pages: forms, navigation, redirects, and route state.
- Family list pages: query filters, loading, errors, and mapped results.

## Fast live-test checklist

1. Must a changing value appear on screen? Use state.
2. Must external work happen when a value changes? Use an effect.
3. Is the value in the path? Use params.
4. Is it after `?`? Use search params.
5. Must code redirect? Use navigate.
6. Is data shared across distant components? Use context/custom hook.
7. Must a DOM node or non-rendering value persist? Use a ref.

Finally verify top-level hook calls, complete dependencies, immutable state updates, and loading/error/empty/success UI.
