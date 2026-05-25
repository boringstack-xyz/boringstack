# Component anatomy

Read when creating a new component, splitting a growing one, or
deciding where state belongs.

## Principles

1. **Pure JSX.** A component (`*.tsx`) renders props. It does not own
   state.
2. **State in hooks.** All `useState`, `useReducer`, `useEffect`,
   `useMemo`, `useCallback`, `useLayoutEffect` live in `*.hooks.ts`.
   The component imports the hook and consumes its return value.
3. **Props describe visual state.** Use `isDisabled`, not
   `isUserAuthenticated`. Use `variant`, not `currentRole`. Business
   logic stays in the hook; the component sees a reduced view-model.
4. **Composable.** Build small components that combine. shadcn/ui
   primitives (`src/components/ui/`) are the atom; `core/` are our
   compositions; `global/` are app-shell wrappers.
5. **Self-contained.** Every component folder contains everything it
   needs. No `utils/Button.utils.ts` in some far-away folder.

## Folder layout

```
ComponentName/
├── ComponentName.tsx        # Pure JSX
├── ComponentName.hooks.ts   # State, effects, callbacks
├── ComponentName.types.ts   # IComponentNameProps + IComponentNameView
├── ComponentName.constants.ts
├── ComponentName.utils.ts   # Optional, pure helpers
├── ComponentName.stories.tsx
├── ComponentName.test.tsx
└── index.ts                 # export { default as ComponentName } from "./ComponentName";
```

Lint enforces the required siblings (`component-folder-structure` +
`index-must-reexport-default`). shadcn primitives in
`src/components/ui/` are exempt.
