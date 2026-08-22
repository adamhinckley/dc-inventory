# Vendor the internal dashboard design system

Status: Accepted
Date: 2026-08-22

## Context

The scaffold locked IBM Carbon White / Gray 100 hex and a thin shadcn-style primitive set ([0003](./0003-tailwind-shadcn-ui-primitives.md)). Staff chrome still looked like a generic admin kit: flat sidebar, IBM role names (`layer-01`, `text-primary`), no elevation stack.

A production design system (tokens, AppShell, primitives, explorer/detail layouts) is a better visual language: semantic surfaces, type composites, intent spacing, quieter default buttons, elevated page panel.

Wholesale is a different product (browse, PDP, cart) with its own canvas/ink/accent tokens in `apps/wholesale`. It must not mount AppShell or DataTable.

## Decision

1. **Internal only.** Vendored design-system code lives in `packages/ui` (`tokens/`, `ui/`, `shells/`, `layouts/`) and is consumed by `apps/internal` and `packages/ui-internal`. Hex values stay Carbon White / g100. Token **names** are the semantic set (`surface-base`, `fg`, `interactive`, `.page`, `.section-flat`).
2. **Wholesale follows the same principles, not the same kit.** Elevation (base / raised / overlay), type roles, intent-named spacing, and `.interactable` behavior should show up in the shop — implemented with shop tokens (`canvas`, `ink`, `accent`), not dashboard Carbon variables or AppShell.
3. **Parked.** `ui/Charts` (this repo keeps Recharts + Okabe–Ito) and `resource/*` (this repo keeps `DataTable` + OpenAPI `x-table`).

## Consequences

- Agents writing internal UI use `bg-surface-base`, `text-fg`, `page-title`, `section-flat` — never raw hex, never `bg-layer-01`.
- Agents writing wholesale UI do not import AppShell or `ui-internal`. They copy the *ideas* (raised surfaces, composite type, quiet chrome) onto shop tokens.
- [0003](./0003-tailwind-shadcn-ui-primitives.md) still forbids a second runtime UI framework; this ADR replaces “thin shadcn-only kit” as the visual contract for the staff dashboard.
