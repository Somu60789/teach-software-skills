# React

## Prerequisites

Before working through this document you should be comfortable with:

- **HTML & CSS**: semantic elements, class/id selectors, box model, flexbox basics
- **JavaScript (ES6+)**:
  - Arrow functions: `const add = (a, b) => a + b`
  - Destructuring: `const { name, age } = user` / `const [first, ...rest] = arr`
  - Spread operator: `const merged = { ...defaults, ...overrides }`
  - Template literals: `` `Hello, ${name}!` ``
  - ES modules: `import`/`export`, default vs named exports
  - Array methods: `.map()`, `.filter()`, `.reduce()`, `.find()`
  - `async`/`await` and `Promise` basics
  - Optional chaining (`?.`) and nullish coalescing (`??`)

If any of these feel unfamiliar, spend 30 minutes on MDN before continuing. React code uses all of the above constantly — without them, every example will look confusing.

---

## What & Why

### Declarative vs Imperative UI

Before React, building UIs meant writing **imperative** code: you told the browser exactly what to do step-by-step.

```js
// Imperative (vanilla JS)
const btn = document.getElementById('btn');
const count = document.getElementById('count');
let n = 0;
btn.addEventListener('click', () => {
  n += 1;
  count.textContent = n; // manually update the DOM
});
```

React uses a **declarative** model: you describe *what* the UI should look like for a given state, and React figures out *how* to update the DOM.

```jsx
// Declarative (React)
function Counter() {
  const [n, setN] = React.useState(0);
  return <button onClick={() => setN(n + 1)}>Clicked {n} times</button>;
}
```

You never touch the DOM directly. When `n` changes, React works out the minimal set of DOM mutations needed.

### The Component Model

React UIs are trees of **components** — self-contained pieces of UI that own their markup, logic, and (optionally) their own state. Components compose: a `Page` contains a `Header`, which contains a `NavLink`. This mirrors how designers think in reusable blocks.

### Virtual DOM

React maintains an in-memory representation of the DOM (the "virtual DOM"). On each render it diffs the new virtual tree against the previous one and applies only the necessary real DOM changes. This is faster than naively re-rendering the whole page and avoids the complexity of manually tracking what changed.

### One-Way Data Flow

Data in React flows **down** via props (parent → child). Children cannot directly mutate a parent's state — they call callback functions passed as props. This makes data flow predictable and easy to trace when debugging.

### Why TML Chose React

- **Ecosystem maturity**: React has been production-proven at Facebook-scale since 2013. Libraries exist for virtually every need (routing, state, forms, data fetching, animation, testing).
- **Component reuse**: TML's `avant-garde-components-library` is built on React — every product team shares the same design-system components.
- **Strong TypeScript support**: React's type definitions are comprehensive. Generic components, typed props, and typed hooks all work seamlessly.
- **Team expertise**: The majority of TML frontend engineers already know React, which reduces onboarding friction and makes code reviews productive.
- **Vite + React**: The TML stack uses Vite for sub-second HMR and near-instant builds, making the developer experience fast even in large repos.

---

## Core Concepts

### JSX

JSX is a syntax extension that lets you write HTML-like markup inside JavaScript. Babel (or Vite's esbuild) transforms it into `React.createElement()` calls.

```jsx
// What you write
const element = <h1 className="title">Hello, {name}!</h1>;

// What the compiler produces
const element = React.createElement('h1', { className: 'title' }, 'Hello, ', name, '!');
```

Key JSX rules:
- Use `className` instead of `class`, `htmlFor` instead of `for`
- Every component must return a **single root element** (or a Fragment: `<>...</>`)
- Expressions go inside `{}` — any valid JS expression works
- Self-closing tags must have `/`: `<img />`, `<Input />`

### Functional Components

A component is a function that accepts a `props` object and returns JSX.

```jsx
function Greeting({ name, role = 'user' }) {
  return (
    <div>
      <h2>Welcome, {name}</h2>
      <p>Role: {role}</p>
    </div>
  );
}
```

### Props

Props are read-only inputs passed from parent to child, just like function arguments.

```jsx
// Parent
function App() {
  return <UserCard name="Somasekhar" department="Engineering" avatarUrl="/avatar.png" />;
}

// Child
function UserCard({ name, department, avatarUrl }) {
  return (
    <div className="card">
      <img src={avatarUrl} alt={name} />
      <h3>{name}</h3>
      <span>{department}</span>
    </div>
  );
}
```

### State with useState

`useState` declares a piece of state local to a component. It returns `[currentValue, setter]`.

```jsx
import { useState } from 'react';

function Toggle() {
  const [isOn, setIsOn] = useState(false);

  return (
    <button onClick={() => setIsOn(prev => !prev)}>
      {isOn ? 'ON' : 'OFF'}
    </button>
  );
}
```

**Rule**: never mutate state directly (`state.push(x)` is wrong). Always create new values and pass them to the setter.

### Component Lifecycle via Hooks

`useEffect` handles side effects: data fetching, subscriptions, timers, DOM manipulation. It runs after the render is committed to the screen.

```jsx
import { useState, useEffect } from 'react';

function Clock() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id); // cleanup when component unmounts
  }, []); // empty array = run once on mount

  return <p>{time.toLocaleTimeString()}</p>;
}
```

The dependency array controls when the effect re-runs:
- `[]` — once on mount, cleanup on unmount
- `[value]` — re-run whenever `value` changes
- no array — re-run after every render (rarely what you want)

### Event Handling

React events are synthetic wrappers around native browser events. Pass handler functions, never call them.

```jsx
function Form() {
  const [text, setText] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    console.log('Submitted:', text);
  }

  return (
    <form onSubmit={handleSubmit}>
      <input value={text} onChange={e => setText(e.target.value)} />
      <button type="submit">Send</button>
    </form>
  );
}
```

---

## Installation & Setup

### Create a New Project with Vite

```bash
npm create vite@latest my-app -- --template react
cd my-app && npm install && npm run dev
```

Vite starts a dev server at `http://localhost:5173` with Hot Module Replacement — changes appear in the browser without a full page reload.

### Project Structure

```
my-app/
├── index.html          # Entry HTML — contains <div id="root">
├── vite.config.js      # Vite configuration
├── package.json
└── src/
    ├── main.jsx        # Mounts the React tree into #root
    ├── App.jsx         # Root application component
    ├── App.css
    └── index.css       # Global styles
```

**src/main.jsx** — bootstraps the app:
```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

**src/App.jsx** — hello world:
```jsx
function App() {
  return (
    <div>
      <h1>Hello, React!</h1>
      <p>Edit src/App.jsx and save to see HMR in action.</p>
    </div>
  );
}

export default App;
```

`StrictMode` renders components twice in development (not in production) to surface bugs from impure render functions and deprecated APIs. Keep it on.

---

## Beginner

### useState Counter

```jsx
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
      <button onClick={() => setCount(c => c - 1)}>Decrement</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  );
}
```

Use the **functional update form** (`c => c + 1`) when the new state depends on the old state. This is safe even when React batches multiple state updates.

### useEffect for Data Fetching with Cleanup

```jsx
import { useState, useEffect } from 'react';

function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false; // prevent state update on unmounted component

    async function fetchUser() {
      try {
        setLoading(true);
        const res = await fetch(`https://jsonplaceholder.typicode.com/users/${userId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setUser(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchUser();
    return () => { cancelled = true; }; // cleanup
  }, [userId]); // re-fetch when userId changes

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;
  return <h2>{user?.name}</h2>;
}
```

The `cancelled` flag prevents "Can't perform a React state update on an unmounted component" warnings when the component unmounts before the fetch resolves.

### Props Drilling (3 Levels Deep)

```jsx
function App() {
  const theme = 'dark';
  return <Layout theme={theme} />;
}

function Layout({ theme }) {
  return (
    <main>
      <Sidebar theme={theme} />
    </main>
  );
}

function Sidebar({ theme }) {
  return <div className={`sidebar sidebar--${theme}`}>Sidebar</div>;
}
```

This pattern works for shallow trees. When drilling gets past 2-3 levels, switch to `useContext` (see Intermediate section). Excessive prop drilling makes components brittle and hard to refactor.

### Conditional Rendering

```jsx
function StatusBadge({ status, count }) {
  return (
    <div>
      {/* Ternary for if/else */}
      {status === 'active' ? (
        <span className="badge green">Active</span>
      ) : (
        <span className="badge red">Inactive</span>
      )}

      {/* && for "only show if truthy" */}
      {count > 0 && <span className="count">{count} items</span>}

      {/* Nullish coalescing for fallback */}
      <p>{status ?? 'Unknown'}</p>
    </div>
  );
}
```

Avoid using `0 && <Component />` — falsy `0` renders as the text "0". Use `count > 0 && ...` or `Boolean(count) && ...` instead.

### Lists with .map() and the key Prop

```jsx
function TaskList({ tasks }) {
  if (tasks.length === 0) return <p>No tasks.</p>;

  return (
    <ul>
      {tasks.map(task => (
        <li key={task.id} className={task.done ? 'done' : ''}>
          {task.title}
        </li>
      ))}
    </ul>
  );
}

// Usage
const tasks = [
  { id: 1, title: 'Write tests', done: true },
  { id: 2, title: 'Deploy to staging', done: false },
];
<TaskList tasks={tasks} />
```

`key` must be **stable** and **unique among siblings**. Using array index as key breaks animations and can cause incorrect reconciliation when items are reordered or removed. Always use an entity ID.

---

## Intermediate

### Custom Hook: useFetch

Extract reusable logic into custom hooks. A custom hook is just a function whose name starts with `use` and that can call other hooks.

```jsx
import { useState, useEffect } from 'react';

function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [url]);

  return { data, loading, error };
}

// Usage — component is now trivial
function PostList() {
  const { data, loading, error } = useFetch('https://jsonplaceholder.typicode.com/posts');

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;
  return <ul>{data.map(p => <li key={p.id}>{p.title}</li>)}</ul>;
}
```

### useCallback and useMemo

Both hooks memoize values across renders. Use them when you have a genuine performance problem — not preemptively.

```jsx
import { useState, useCallback, useMemo } from 'react';

function ExpensiveList({ items, onSelect }) {
  return (
    <ul>
      {items.map(item => (
        <li key={item.id} onClick={() => onSelect(item.id)}>
          {item.name}
        </li>
      ))}
    </ul>
  );
}

function Dashboard({ rawItems }) {
  const [filter, setFilter] = useState('');
  const [selectedId, setSelectedId] = useState(null);

  // useMemo: recompute only when rawItems or filter changes
  const filteredItems = useMemo(
    () => rawItems.filter(item => item.name.toLowerCase().includes(filter.toLowerCase())),
    [rawItems, filter]
  );

  // useCallback: stable function reference so child doesn't re-render
  const handleSelect = useCallback((id) => {
    setSelectedId(id);
  }, []); // no deps — function never changes

  return (
    <>
      <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter..." />
      <ExpensiveList items={filteredItems} onSelect={handleSelect} />
      <p>Selected: {selectedId}</p>
    </>
  );
}
```

`useMemo` is worth it when the computation is expensive (sorting/filtering large arrays). `useCallback` is worth it when passing callbacks to memoized child components (`React.memo`). Both add overhead — profile before adding them.

### useRef

`useRef` has two use-cases: accessing a DOM node imperiously, and storing a mutable value that does not trigger re-renders.

```jsx
import { useRef, useEffect, useState } from 'react';

function VideoPlayer({ src }) {
  const videoRef = useRef(null);   // DOM access
  const playCountRef = useRef(0);  // mutable value, not displayed

  function handlePlay() {
    playCountRef.current += 1;     // mutation is fine — no re-render needed
    videoRef.current.play();
  }

  function handlePause() {
    videoRef.current.pause();
  }

  return (
    <div>
      <video ref={videoRef} src={src} />
      <button onClick={handlePlay}>Play</button>
      <button onClick={handlePause}>Pause</button>
    </div>
  );
}
```

Never read `ref.current` during render — it will be `null` until after the first commit.

### useContext: Theme Example

Context solves the prop-drilling problem by making a value available to any descendant without explicit prop passing.

```jsx
import { createContext, useContext, useState } from 'react';

// 1. Create context
const ThemeContext = createContext('light');

// 2. Provide it near the top of the tree
function App() {
  const [theme, setTheme] = useState('light');

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <Layout />
    </ThemeContext.Provider>
  );
}

// 3. Consume it anywhere below
function ThemeToggle() {
  const { theme, setTheme } = useContext(ThemeContext);
  return (
    <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
      Current theme: {theme}
    </button>
  );
}

function DeepChild() {
  const { theme } = useContext(ThemeContext);
  return <div className={`panel panel--${theme}`}>Deep content</div>;
}
```

Context re-renders **all consumers** when the value changes. For high-frequency updates (mouse position, scroll), prefer Zustand or Recoil rather than Context.

### React Router v6

```bash
npm install react-router-dom
```

```jsx
import {
  BrowserRouter, Routes, Route, Link,
  Outlet, useParams, useNavigate
} from 'react-router-dom';

// Root layout with nav
function RootLayout() {
  return (
    <div>
      <nav>
        <Link to="/">Home</Link>
        <Link to="/users">Users</Link>
      </nav>
      <Outlet /> {/* renders the matched child route */}
    </div>
  );
}

function UsersPage() {
  return (
    <div>
      <h1>Users</h1>
      <Link to="42">View user 42</Link>
    </div>
  );
}

function UserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();

  return (
    <div>
      <h2>User #{userId}</h2>
      <button onClick={() => navigate(-1)}>Back</button>
      <button onClick={() => navigate('/users')}>All Users</button>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<RootLayout />}>
          <Route index element={<h1>Home</h1>} />
          <Route path="users" element={<UsersPage />} />
          <Route path="users/:userId" element={<UserDetail />} />
          <Route path="*" element={<h1>404 Not Found</h1>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

Nested routes use `<Outlet />` as a slot where the matched child renders. `useNavigate` handles programmatic navigation; `useParams` extracts URL parameters.

### Code Splitting with React.lazy and Suspense

Ship only the JavaScript a user needs for the current route by lazily loading route components.

```jsx
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

const HomePage = lazy(() => import('./pages/HomePage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ReportsPage = lazy(() => import('./pages/ReportsPage'));

function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<div className="page-spinner">Loading...</div>}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
```

Each lazy-loaded page becomes a separate chunk. Vite generates `DashboardPage-[hash].js` that is only downloaded when the user navigates to `/dashboard`.

---

## Advanced

### React.memo to Prevent Re-renders

By default, a parent re-render causes all children to re-render. `React.memo` wraps a component and skips re-rendering if its props haven't changed (shallow equality).

```jsx
import { memo, useState } from 'react';

const ExpensiveChart = memo(function ExpensiveChart({ data, title }) {
  console.log('Chart rendered'); // only prints when data or title changes
  return <div>{/* heavy chart rendering */}{title}</div>;
});

function Dashboard() {
  const [ticker, setTicker] = useState(0);
  const chartData = useMemo(() => computeHeavyData(), []); // stable reference

  return (
    <div>
      <button onClick={() => setTicker(t => t + 1)}>Tick ({ticker})</button>
      <ExpensiveChart data={chartData} title="Revenue" />
      {/* ExpensiveChart does NOT re-render when ticker changes */}
    </div>
  );
}
```

`React.memo` only helps when the parent re-renders frequently and the child is expensive. The memoization itself has a cost — measure first.

### Virtualized Lists with react-virtuoso

Rendering 1000+ DOM nodes is slow. Virtualization renders only the items currently visible in the viewport.

```bash
npm install react-virtuoso
```

```jsx
import { Virtuoso } from 'react-virtuoso';

const items = Array.from({ length: 10000 }, (_, i) => ({
  id: i,
  name: `Item ${i}`,
  description: `Description for item ${i}`,
}));

function HugeList() {
  return (
    <Virtuoso
      style={{ height: '600px' }}
      data={items}
      itemContent={(index, item) => (
        <div key={item.id} style={{ padding: '8px', borderBottom: '1px solid #eee' }}>
          <strong>{item.name}</strong>
          <p>{item.description}</p>
        </div>
      )}
    />
  );
}
```

Only ~20-30 items are in the DOM at any time regardless of list length. Scroll performance stays smooth at 60fps.

### Drag and Drop with react-beautiful-dnd

```bash
npm install react-beautiful-dnd
```

```jsx
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useState } from 'react';

const initialItems = [
  { id: 'item-1', content: 'Task A' },
  { id: 'item-2', content: 'Task B' },
  { id: 'item-3', content: 'Task C' },
];

function reorder(list, startIndex, endIndex) {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

function KanbanColumn() {
  const [items, setItems] = useState(initialItems);

  function onDragEnd(result) {
    if (!result.destination) return; // dropped outside list
    setItems(reorder(items, result.source.index, result.destination.index));
  }

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Droppable droppableId="column">
        {(provided) => (
          <ul ref={provided.innerRef} {...provided.droppableProps}>
            {items.map((item, index) => (
              <Draggable key={item.id} draggableId={item.id} index={index}>
                {(provided, snapshot) => (
                  <li
                    ref={provided.innerRef}
                    {...provided.draggableProps}
                    {...provided.dragHandleProps}
                    style={{
                      backgroundColor: snapshot.isDragging ? '#e8f4fd' : '#fff',
                      padding: 12,
                      marginBottom: 8,
                      ...provided.draggableProps.style,
                    }}
                  >
                    {item.content}
                  </li>
                )}
              </Draggable>
            ))}
            {provided.placeholder}
          </ul>
        )}
      </Droppable>
    </DragDropContext>
  );
}
```

### WebSocket Integration with Cleanup

```jsx
import { useState, useEffect, useRef } from 'react';

function LiveFeed({ channelId }) {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    const ws = new WebSocket(`wss://api.example.com/channels/${channelId}`);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      setMessages(prev => [...prev, msg]);
    };

    ws.onerror = (err) => console.error('WebSocket error:', err);

    ws.onclose = () => setConnected(false);

    // CRITICAL: always close the socket on unmount / channelId change
    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [channelId]); // reconnect when channel changes

  return (
    <div>
      <p>Status: {connected ? 'Connected' : 'Disconnected'}</p>
      <ul>
        {messages.map((msg, i) => <li key={i}>{msg.text}</li>)}
      </ul>
    </div>
  );
}
```

Without the cleanup return, switching channels leaks WebSocket connections. The old socket keeps firing `onmessage` and calling `setMessages` on a component that may be unmounted or listening to the wrong channel.

### Error Boundaries

React's error handling for render errors. Must be a class component (no hook equivalent yet, though `react-error-boundary` wraps this cleanly).

```jsx
import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log to Sentry, Datadog, etc.
    console.error('Boundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <p>Something went wrong.</p>;
    }
    return this.props.children;
  }
}

// Usage
function App() {
  return (
    <ErrorBoundary fallback={<div className="error-page">Failed to load widget.</div>}>
      <UnreliableWidget />
    </ErrorBoundary>
  );
}
```

Error boundaries catch errors during rendering, in lifecycle methods, and in constructors of child components. They do **not** catch errors in event handlers (use try/catch there) or async code.

---

## Expert

### Reconciliation Algorithm

When state or props change, React calls the component function again to get a new virtual DOM tree. It then **diffs** the old and new trees to find the minimum set of DOM operations.

React's diffing makes two assumptions that make it O(n) instead of O(n³):
1. Elements of different types produce entirely different trees. React tears down the old subtree and builds the new one from scratch.
2. The `key` prop tells React which items in a list correspond to which items in the previous render.

**Why keys matter in lists:**
```jsx
// Without keys (or with index keys): React sees 3 <li> elements in both trees.
// If you prepend an item, React re-uses the existing DOM nodes incorrectly,
// causing input state and focus to land on the wrong items.

// With stable keys: React matches the key "item-2" in the old tree to "item-2"
// in the new tree and moves the DOM node rather than recreating it.
```

### Fiber Architecture

React 16 rewrote its internals with Fiber — a linked-list of work units that replaces the old recursive call stack renderer.

Key ideas:
- **Work units**: Each component in the tree is a Fiber node. Rendering is a traversal of these nodes.
- **Interruptible rendering**: Because Fiber uses an explicit data structure instead of the call stack, React can pause mid-render, hand control back to the browser (for input, animations), then resume.
- **Concurrent Mode**: The scheduler assigns priority to updates. A button click is urgent; a background data refresh is not. Low-priority work is done during idle time.
- **Lanes**: React 18 uses a bitmask system called "lanes" to batch and prioritize multiple updates efficiently.

### useTransition and useDeferredValue

Both are Concurrent Mode tools for keeping the UI responsive during expensive updates.

```jsx
import { useState, useTransition, useDeferredValue, useMemo } from 'react';

// useTransition — marks an update as non-urgent
function SearchPage() {
  const [query, setQuery] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleChange(e) {
    const val = e.target.value;
    setQuery(val); // urgent — update input immediately

    startTransition(() => {
      // non-urgent — React may defer this if needed
      // e.g., trigger a navigation or heavy filter
    });
  }

  return (
    <div>
      <input value={query} onChange={handleChange} />
      {isPending && <span>Searching...</span>}
    </div>
  );
}

// useDeferredValue — defers reading a value
function FilteredList({ items, filterText }) {
  const deferredFilter = useDeferredValue(filterText); // lags behind when CPU is busy

  const filtered = useMemo(
    () => items.filter(i => i.name.includes(deferredFilter)),
    [items, deferredFilter]
  );

  return <ul>{filtered.map(i => <li key={i.id}>{i.name}</li>)}</ul>;
}
```

`useTransition` wraps the state setter. `useDeferredValue` wraps the value after it is already in state. Use `useTransition` when you own the state update, `useDeferredValue` when you receive the value as a prop.

### Profiling with React DevTools

Install the **React Developer Tools** browser extension. It adds two tabs:

- **Components**: inspect component tree, props, state, hooks in real time. Click "eye" icon to highlight re-renders.
- **Profiler**: record a session and see exactly which components rendered, how long each took, and *why* (what changed).

Workflow:
1. Open DevTools → Profiler → click Record
2. Perform the interaction you want to profile (click a button, type in a field)
3. Stop recording
4. Inspect the flamegraph. Yellow = slow. Click a bar to see "Why did this render?" — it tells you which prop or hook value changed.

### Common Performance Anti-Patterns

```jsx
// BAD: creates a new object every render — breaks React.memo and useEffect deps
function Parent() {
  return <Child options={{ theme: 'dark', size: 'lg' }} />;
}
// FIX: define outside component or use useMemo
const OPTIONS = { theme: 'dark', size: 'lg' };
function Parent() {
  return <Child options={OPTIONS} />;
}

// BAD: anonymous function creates new reference each render
function List({ items }) {
  return items.map(item => (
    <Row key={item.id} onClick={() => console.log(item.id)} />
  ));
}
// FIX: useCallback or move handler inside Row

// BAD: derived state stored in useState
const [fullName, setFullName] = useState(`${firstName} ${lastName}`);
// FIX: compute during render — no state needed
const fullName = `${firstName} ${lastName}`;

// BAD: missing dependency in useEffect (stale closure)
useEffect(() => {
  fetchData(userId); // userId may be stale
}, []); // should be [userId]
```

---

## In the TML Codebase

### Vite `src/` Path Alias

TML's Vite configs define a `src` alias that maps to the project `src/` directory. This eliminates relative import hell.

```jsx
// Instead of this:
import { getApiResponse } from '../../../constants/commonUtils';

// Write this (works from any depth):
import { getApiResponse } from 'src/constants/commonUtils';
```

The alias is configured in `vite.config.js`:
```js
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { src: path.resolve(__dirname, 'src') },
  },
});
```

### Shared Axios Wrapper: getApiResponse

`src/constants/commonUtils.jsx` exports a single function that all API calls go through. It handles authentication, timeout, and error normalisation so no component ever needs to worry about these.

```jsx
// src/constants/commonUtils.jsx (simplified)
import axios from 'axios';

export async function getApiResponse(url, body = {}, method = 'POST') {
  const token = localStorage.getItem('authToken');
  try {
    const response = await axios({
      url,
      method,
      data: body,
      timeout: 60000, // 60-second timeout
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  } catch (error) {
    // Errors become response objects — callers check a status/success field
    return { success: false, message: error.message, error };
  }
}

// Usage in a component
import { getApiResponse } from 'src/constants/commonUtils';

async function loadDashboard() {
  const result = await getApiResponse('/api/dashboard/summary', { userId: 42 }, 'POST');
  if (!result.success) {
    console.error(result.message);
    return;
  }
  setDashboardData(result.data);
}
```

Key properties: 60-second timeout (important for slow backend queries), bearer token injected automatically, errors never throw — they return an error-shaped object. Always check `result.success` before using the data.

### Recoil Atoms (control-tower-web-frontend)

Global state in the control-tower repo uses Recoil. Atoms live in `src/recoil/`.

```jsx
// src/recoil/themeAtom.js
import { atom } from 'recoil';
import { recoilPersist } from 'recoil-persist';

const { persistAtom } = recoilPersist();

export const themeState = atom({
  key: 'themeState',     // globally unique key
  default: 'light',
  effects: [persistAtom], // persists to localStorage automatically
});

// Reading and writing an atom in a component
import { useRecoilState, useRecoilValue } from 'recoil';
import { themeState } from 'src/recoil/themeAtom';

function ThemeToggle() {
  const [theme, setTheme] = useRecoilState(themeState);
  return (
    <button onClick={() => setTheme(t => t === 'light' ? 'dark' : 'light')}>
      Theme: {theme}
    </button>
  );
}

// Read-only (no subscription to setter changes)
function ThemedPanel() {
  const theme = useRecoilValue(themeState);
  return <div className={`panel panel--${theme}`} />;
}
```

`persistAtom` syncs the atom to `localStorage` so the user's theme preference survives page refreshes.

### Route Constants Pattern

Routes are not written as string literals scattered through the app. They are centralised in `src/constants/constants.jsx` as a `navigationObject` array.

```jsx
// src/constants/constants.jsx
import DashboardPage from 'src/pages/DashboardPage';
import ReportsPage from 'src/pages/ReportsPage';
import SettingsPage from 'src/pages/SettingsPage';

export const navigationObject = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    component: DashboardPage,
    icon: 'dashboard',
    roles: ['admin', 'operator'],
  },
  {
    path: '/reports',
    label: 'Reports',
    component: ReportsPage,
    icon: 'bar-chart',
    roles: ['admin'],
  },
  {
    path: '/settings',
    label: 'Settings',
    component: SettingsPage,
    icon: 'settings',
    roles: ['admin'],
  },
];

// src/App.jsx — generate Routes dynamically
import { Routes, Route } from 'react-router-dom';
import { navigationObject } from 'src/constants/constants';

function AppRoutes() {
  return (
    <Routes>
      {navigationObject.map(({ path, component: Page }) => (
        <Route key={path} path={path} element={<Page />} />
      ))}
    </Routes>
  );
}
```

This pattern means adding a new page is a one-line change in `constants.jsx` — no hunting for the Routes definition.

### MUI Theming

The apps wrap everything in MUI's `ThemeProvider` so every MUI component inherits the TML design tokens.

```jsx
// src/theme.js
import { createTheme } from '@mui/material/styles';

export const tmlTheme = createTheme({
  palette: {
    primary: { main: '#0057B8' },    // TML blue
    secondary: { main: '#FF6B35' },  // TML orange
    background: { default: '#F5F7FA' },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
  },
});

// src/main.jsx
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { tmlTheme } from './theme';

createRoot(document.getElementById('root')).render(
  <ThemeProvider theme={tmlTheme}>
    <CssBaseline /> {/* normalise browser styles */}
    <App />
  </ThemeProvider>
);
```

Dark mode: create a second theme and swap the `ThemeProvider`'s `theme` prop based on the Recoil `themeState` atom.

### avant-garde-components-library

Internal TML component library. Import like any npm package — it is listed in `package.json` and pulled from the private registry.

```jsx
import {
  DataTable,
  StatusChip,
  PageHeader,
  ConfirmDialog,
} from 'avant-garde-components-library';

function FleetPage() {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <PageHeader title="Fleet Overview" subtitle="Live vehicle status" />
      <DataTable
        columns={[
          { field: 'vehicleId', headerName: 'Vehicle ID' },
          { field: 'status', headerName: 'Status',
            renderCell: ({ value }) => <StatusChip status={value} /> },
        ]}
        rows={fleetData}
        onRowClick={(row) => navigate(`/fleet/${row.vehicleId}`)}
      />
      <ConfirmDialog
        open={confirmOpen}
        title="Decommission vehicle?"
        onConfirm={handleDecommission}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
```

Prefer components from this library over rolling your own — they are already tested, themed, and accessible.

---

## Quick Reference

### Hook Signatures

| Hook | Signature | When to use |
|------|-----------|-------------|
| `useState` | `const [val, setVal] = useState(initial)` | Local component state |
| `useEffect` | `useEffect(() => { ... return cleanup; }, [deps])` | Side effects, subscriptions, timers |
| `useCallback` | `const fn = useCallback(() => { ... }, [deps])` | Stable callback reference for memoized children |
| `useMemo` | `const val = useMemo(() => compute(), [deps])` | Expensive derived values |
| `useRef` | `const ref = useRef(initialValue)` | DOM access or mutable instance variable |
| `useContext` | `const value = useContext(MyContext)` | Consume a context value |
| `useReducer` | `const [state, dispatch] = useReducer(reducer, init)` | Complex state with multiple sub-values |
| `useTransition` | `const [isPending, startTransition] = useTransition()` | Non-urgent state updates |
| `useDeferredValue` | `const deferred = useDeferredValue(value)` | Defer reading a rapidly-changing value |

### React Router v6 Quick Reference

| Task | Code |
|------|------|
| Wrap app | `<BrowserRouter><App /></BrowserRouter>` |
| Define routes | `<Routes><Route path="/foo" element={<Foo />} /></Routes>` |
| Nested routes | Child `<Route>` inside parent, `<Outlet />` in parent element |
| Index route | `<Route index element={<Home />} />` |
| Navigate link | `<Link to="/path">Label</Link>` |
| Active link | `<NavLink to="/path" className={({isActive}) => isActive ? 'active' : ''}>`|
| URL params | `const { id } = useParams()` |
| Programmatic nav | `const navigate = useNavigate(); navigate('/path')` |
| Go back | `navigate(-1)` |
| Query params | `const [params] = useSearchParams(); params.get('q')` |
| Redirect | `<Navigate to="/login" replace />` |

### Common Pitfalls

1. **Missing `key` prop**: React warns and may render lists incorrectly. Always use a stable entity ID.
2. **Using index as key**: Breaks state preservation when list items reorder. Use an ID.
3. **Empty or wrong `useEffect` deps**: Empty array with inside references causes stale closures. Wrong deps cause infinite loops (e.g., putting an object literal in deps).
4. **Setting state during render**: Causes an infinite render loop. State updates must be inside event handlers or `useEffect`.
5. **Not returning cleanup from `useEffect`**: Leaks subscriptions, timers, WebSockets, and can trigger state updates on unmounted components.
6. **Mutating state directly**: `state.items.push(x)` does not trigger a re-render. Use `setState([...state.items, x])`.
7. **Overusing `useContext` for high-frequency updates**: Every consumer re-renders on every context change. Split contexts or use an atom-based library (Recoil/Zustand).
8. **Forgetting `async` wrapper in `useEffect`**: You cannot pass an async function directly to `useEffect` — it returns a Promise, not a cleanup function. Declare the async function inside and call it.
9. **New object/array/function literals as props**: `<Comp style={{ color: 'red' }} />` creates a new object every render, defeating `React.memo`. Hoist to module scope or use `useMemo`/`useCallback`.
10. **Not handling loading and error states**: Rendering `data.map(...)` before the fetch resolves throws "Cannot read properties of null". Always initialise state to a safe value and guard with `if (loading) return ...`.
