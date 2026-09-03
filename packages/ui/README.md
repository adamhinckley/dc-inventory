# `@dc-inventory/ui`

**Internal dashboard** design system: Tailwind v4 tokens, Base UI primitives, AppShell.

This is not a domain package. It is not the wholesale shop chrome.

## Audience

| App | Uses this package? |
|---|---|
| `apps/internal` | Yes — tokens, primitives, AppShell |
| `packages/ui-internal` | Yes — DataTable / charts consume token classes |
| `apps/wholesale` | No AppShell / dashboard tokens. Shop CSS stays in the wholesale app. Mirror elevation, type roles, and intent spacing on canvas/ink/accent tokens. |

Hex values: Carbon White (default) + Gray 100 (`.dark`). Names: `surface-base`, `fg`, `primary-strong`, `.page`, `.section-flat`. Spec: [`docs/work-dashboard-design-spec.md`](../../docs/work-dashboard-design-spec.md). ADR: [`docs/adr/0006-vendor-design-system.md`](../../docs/adr/0006-vendor-design-system.md). Do not invent hex.

## How to consume

```ts
import { Button, AppShell, formatMoneyMinorUnits } from "@dc-inventory/ui";
import "@dc-inventory/ui/globals.css";
```

Write token classes (`bg-surface-base`, `text-fg`, `page-title`, `dark:`). Dark is class-based: put `.dark` on `<html>` or a shell. Light stays the default.

Form rows: [`docs/work-dashboard-design-spec.md`](../../docs/work-dashboard-design-spec.md) §12. Use `FieldRow` / `LabeledField`. Input, Select, Combobox, and Button `md` share `--space-input-height`. The row action is `variant="primary"`. Button labels are Title Case and bold. Table-page action buttons include a leading icon.

Floating chrome: §13. `.overlay` / `bg-surface-overlay` is the opaque card. `bg-backdrop` is the modal scrim (Carbon `$overlay`).

## Storybook

One monorepo Storybook at the repo root. From the repo root:

```bash
pnpm storybook
```

Toolbar **theme** toggle switches light / dark.

## How to test

```bash
pnpm --filter @dc-inventory/ui test
pnpm --filter @dc-inventory/ui typecheck
```
