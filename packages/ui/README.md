# `@dc-inventory/ui`

Shared **Tailwind CSS v4** primitives and display formatters for the Next.js apps.

This is not a domain package. Buttons, inputs, and money/date **formatting** live here. Shared-kernel `Money` math, Orval clients, and app pages do not.

## What lives here

- `globals.css` — Carbon White (default) + opt-in Gray 100 via `.dark`. Tokens copied from [`docs/work-dashboard-design-spec.md`](../../docs/work-dashboard-design-spec.md) §6. Do not invent hex.
- shadcn-style primitives: `Button`, `Input`, `Label`
- Display formatters: `formatMoneyMinorUnits`, `formatDate`, `formatDateTime`

## How to consume

```ts
import { Button, formatMoneyMinorUnits } from "@dc-inventory/ui";
import "@dc-inventory/ui/globals.css";
```

Write token classes (`bg-background`, `text-primary`, `border-border-strong`, `dark:`). Dark is class-based: put `.dark` on `<html>` or a shell. Light stays the default.

## Storybook

One monorepo Storybook at the repo root covers this package and `packages/ui-internal`. From the repo root:

```bash
pnpm storybook
```

Toolbar **theme** toggle switches light / dark. Stories are components only — no app pages.

## How to test

```bash
pnpm --filter @dc-inventory/ui test
pnpm --filter @dc-inventory/ui typecheck
```
