---
name: react
description: Comprehensive React development guide covering hooks, components, APIs, and best practices. Use when building React applications, components, or needing React-specific guidance.
license: MIT
---

This skill provides comprehensive guidance for React development based on the official React documentation. Use it when building React applications, creating components, managing state, or implementing React patterns.

## Core Concepts

React is a JavaScript library for building user interfaces. Key principles:
- **Declarative**: Describe what UI should look like for any given state
- **Component-Based**: Build encapsulated components that manage their own state
- **Unidirectional Data Flow**: Data flows down through props

## Built-in Hooks

### State Hooks
| Hook | Purpose |
|------|---------|
| `useState` | Declares a state variable that you can update directly |
| `useReducer` | Declares a state variable with update logic inside a reducer function |

```jsx
// useState - simple state
const [count, setCount] = useState(0);

// useReducer - complex state logic
const [state, dispatch] = useReducer(reducer, initialState);
```

### Context Hooks
| Hook | Purpose |
|------|---------|
| `useContext` | Reads and subscribes to a context value |

```jsx
const theme = useContext(ThemeContext);
```

### Ref Hooks
| Hook | Purpose |
|------|---------|
| `useRef` | Declares a ref to hold any value, commonly a DOM node |
| `useImperativeHandle` | Customizes the ref exposed by your component (rarely used) |

```jsx
const inputRef = useRef(null);
// Access: inputRef.current.focus()
```

### Effect Hooks
| Hook | Purpose |
|------|---------|
| `useEffect` | Connects a component to an external system (API calls, subscriptions, DOM manipulation) |
| `useLayoutEffect` | Fires before browser repaints; for measuring layout |
| `useInsertionEffect` | Fires before DOM changes; for CSS-in-JS libraries |
| `useEffectEvent` | Creates non-reactive event handlers for effects |

```jsx
// Basic effect with cleanup
useEffect(() => {
  const subscription = subscribe(id);
  return () => subscription.unsubscribe();
}, [id]);

// Layout measurement
useLayoutEffect(() => {
  const { height } = ref.current.getBoundingClientRect();
  setHeight(height);
}, []);
```

### Performance Hooks
| Hook | Purpose |
|------|---------|
| `useMemo` | Caches expensive calculation results |
| `useCallback` | Caches function definitions for optimized child components |
| `useTransition` | Marks state transitions as non-blocking |
| `useDeferredValue` | Defers updating non-critical UI parts |

```jsx
// Memoize expensive computation
const sortedItems = useMemo(() =>
  items.sort((a, b) => a.name.localeCompare(b.name)),
  [items]
);

// Memoize callback for child optimization
const handleClick = useCallback(() => {
  setCount(c => c + 1);
}, []);

// Non-blocking transitions
const [isPending, startTransition] = useTransition();
startTransition(() => setSearchQuery(input));
```

### Other Hooks
| Hook | Purpose |
|------|---------|
| `useId` | Generates unique IDs for accessibility attributes |
| `useDebugValue` | Customizes DevTools label for custom hooks |
| `useSyncExternalStore` | Subscribes to external stores |
| `useActionState` | Manages state of form actions |

```jsx
const id = useId();
// <label htmlFor={id}>Name</label>
// <input id={id} />
```

## Built-in Components

| Component | Purpose |
|-----------|---------|
| `<Fragment>` or `<>` | Groups elements without adding DOM nodes |
| `<Suspense>` | Shows fallback while children load |
| `<StrictMode>` | Enables extra dev checks to find bugs |
| `<Profiler>` | Measures rendering performance |
| `<Activity>` | Hides/restores UI and internal state |

```jsx
// Suspense for lazy loading
<Suspense fallback={<Loading />}>
  <LazyComponent />
</Suspense>

// StrictMode for development
<StrictMode>
  <App />
</StrictMode>
```

## React APIs

| API | Purpose |
|-----|---------|
| `createContext` | Creates context for sharing data |
| `lazy` | Defers loading component code until first render |
| `memo` | Skips re-renders when props unchanged |
| `forwardRef` | Exposes DOM node to parent via ref (not needed in React 19+) |
| `startTransition` | Marks updates as non-urgent (function version) |
| `use` | Reads Promise or context values |
| `act` | Wraps test renders to ensure updates process |

```jsx
// Context
const ThemeContext = createContext('light');

// Lazy loading
const LazyComponent = lazy(() => import('./Component'));

// Memo for performance
const MemoizedComponent = memo(function MyComponent({ data }) {
  return <div>{data}</div>;
});

// forwardRef (pre-React 19)
const Input = forwardRef(function Input(props, ref) {
  return <input {...props} ref={ref} />;
});

// use hook for promises
function Component({ dataPromise }) {
  const data = use(dataPromise);
  return <div>{data}</div>;
}
```

## Rules of Hooks

1. **Only call hooks at the top level** - Never inside loops, conditions, or nested functions
2. **Only call hooks from React functions** - From function components or custom hooks
3. **Hooks must be called in the same order** - On every render

```jsx
// WRONG
if (condition) {
  const [value, setValue] = useState(0);
}

// CORRECT
const [value, setValue] = useState(0);
if (condition) {
  // use value here
}
```

## Component Patterns

### Controlled vs Uncontrolled Components
```jsx
// Controlled - React manages the value
function ControlledInput() {
  const [value, setValue] = useState('');
  return <input value={value} onChange={e => setValue(e.target.value)} />;
}

// Uncontrolled - DOM manages the value
function UncontrolledInput() {
  const inputRef = useRef(null);
  return <input ref={inputRef} defaultValue="" />;
}
```

### Custom Hooks
```jsx
// Extract reusable logic into custom hooks
function useLocalStorage(key, initialValue) {
  const [stored, setStored] = useState(() => {
    const item = window.localStorage.getItem(key);
    return item ? JSON.parse(item) : initialValue;
  });

  const setValue = (value) => {
    setStored(value);
    window.localStorage.setItem(key, JSON.stringify(value));
  };

  return [stored, setValue];
}
```

### Compound Components
```jsx
// Components that work together
function Tabs({ children, defaultTab }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabsContext.Provider>
  );
}

Tabs.Tab = function Tab({ id, children }) {
  const { activeTab, setActiveTab } = useContext(TabsContext);
  return (
    <button
      onClick={() => setActiveTab(id)}
      data-active={activeTab === id}
    >
      {children}
    </button>
  );
};
```

## Best Practices

### State Management
- Keep state as local as possible
- Lift state up only when necessary
- Use context for truly global state (theme, auth)
- Consider useReducer for complex state logic

### Performance
- Use React DevTools Profiler to identify slow renders
- Memoize expensive calculations with useMemo
- Memoize callbacks with useCallback when passing to optimized children
- Use React.memo for components that render often with same props
- Avoid creating objects/arrays in render (they cause unnecessary re-renders)

### Effects
- Effects are for synchronizing with external systems
- Don't use effects for transforming data (use useMemo)
- Don't use effects for handling user events (use event handlers)
- Always specify dependencies correctly
- Clean up subscriptions and timers in the cleanup function

### Component Design
- Keep components focused on a single responsibility
- Prefer composition over inheritance
- Use children prop for flexible content injection
- Extract repeated UI patterns into reusable components

## Common Patterns

### Data Fetching
```jsx
function useFetch(url) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(url)
      .then(res => res.json())
      .then(data => {
        if (!cancelled) {
          setData(data);
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [url]);

  return { data, loading, error };
}
```

### Event Handling
```jsx
function Form() {
  const handleSubmit = (e) => {
    e.preventDefault();
    // handle submission
  };

  return (
    <form onSubmit={handleSubmit}>
      <button type="submit">Submit</button>
    </form>
  );
}
```

### Conditional Rendering
```jsx
// Using && (short-circuit)
{isLoggedIn && <UserProfile />}

// Using ternary
{isLoading ? <Spinner /> : <Content />}

// Using early return
if (!data) return <Loading />;
return <DataDisplay data={data} />;
```

### Lists and Keys
```jsx
// Always use stable, unique keys
{items.map(item => (
  <ListItem key={item.id} item={item} />
))}

// Never use index as key for dynamic lists
// Only use index when list is static and never reordered
```

## React 19+ Features

In React 19 and later:
- `forwardRef` is no longer needed - pass `ref` as a regular prop
- `use` hook for reading promises and context
- Actions for form handling
- Document metadata components

```jsx
// React 19: ref as prop (no forwardRef needed)
function Input({ ref, ...props }) {
  return <input ref={ref} {...props} />;
}
```
