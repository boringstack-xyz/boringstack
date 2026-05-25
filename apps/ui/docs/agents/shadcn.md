# shadcn/ui

Read when adding a primitive or wondering why `src/components/ui/`
breaks the normal folder rules.

Primitives are owned in `src/components/ui/`. They follow shadcn's
flat single-file convention and are lint-exempt from
`component-folder-structure`, `index-must-reexport-default`, and
`interface-prefix-i`.

## Adding a primitive

```bash
pnpm ui:add button input form label dialog dropdown-menu toast
```

Wire shadcn's CSS variables to our `@theme` tokens in
`src/assets/css/tailwind.css`. Don't fork primitives — extend by
composing in `src/components/core/<Name>/` (full anatomy) on top of
them.
