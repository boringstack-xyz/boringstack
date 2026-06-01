# JSX rules

Read when ESLint pushes back on JSX or you're about to write a
`.map()` inside a return.

## No data computation inside JSX

Lift `.map().filter()`, ternaries, and arithmetic into the hook or a
pre-prep variable. JSX is a template.

❌

```tsx
<ul>
  {items
    .filter((i) => i.visible)
    .map((i) => (
      <li key={i.id}>{i.label.toUpperCase()}</li>
    ))}
</ul>
```

✅

```tsx
// hooks
const visibleItems = useMemo(
  () =>
    items
      .filter((i) => i.visible)
      .map((i) => ({ id: i.id, label: i.label.toUpperCase() })),
  [items]
);

// tsx
<ul>
  {visibleItems.map((i) => (
    <li key={i.id}>{i.label}</li>
  ))}
</ul>;
```

## No inline arrow functions in JSX attributes

Handlers are named function references (`handleSubmit`, `onLogout`).

❌ `onClick={() => doThing(id)}`
✅ Bind in hook:
`const onClickRow = useCallback(() => doThing(id), [id]);`
then `onClick={onClickRow}`.

## No ternaries or template literals in `className=`

Use `classNames(...)` (or `cn(...)` — same allowlist).

❌

```tsx
<div className={`px-4 ${error ? "bg-red-500" : "bg-gray-100"}`} />
```

✅

```tsx
<div className={cn("px-4", error ? "bg-red-500" : "bg-gray-100")} />
// or
<div
  className={classNames("px-4", {
    "bg-red-500": error,
    "bg-gray-100": !error,
  })}
/>
```

## No `dark:` Tailwind classes

This template ships light-mode only by default. Theming is via
`@theme` tokens in `src/assets/css/tailwind.css`. A
`data-theme="dark"` selector overrides the same token names; no
`dark:` variants anywhere.

## A11y baselines

Inputs have associated labels. Interactive non-button elements need
`role` + key handlers. Use `aria-live` for status messages. The
`jsx-a11y` plugin enforces.
