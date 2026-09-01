# DC Inventory verification map

This directory is the source for driving user-facing behavior. Read it before you touch the app. Then open the matching feature file and treat its commands as literal.

Primary surface: staff dashboard `apps/internal` at `http://localhost:3000`. Other surfaces exist. Do not treat them as the default.

## Surfaces

| Surface | Origin | What a user sees |
|---|---|---|
| Staff dashboard (primary) | `http://localhost:3000` | AppShell + tables. Cookie `staff_session`. |
| Wholesale shop | `http://localhost:3002` | Product cards, cart, checkout. Cookie `wholesale_session`. |
| Fastify API | `http://127.0.0.1:3001` | `/health`, `/ready`, `/internal/*`, `/wholesale/*`. Fly in prod. |
| Ops UI | not in this repo yet | `/ops` API mount may exist. Do not invent an ops app. |

## Baseline preconditions

- Repo root is the cwd for `pnpm` and Compose.
- `control` means `node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs`.
- `control doctor` is green for the surfaces you will drive. Internal proof needs API + staff app.
- Browse `http://localhost:3000`, not `http://127.0.0.1:3000`. Next 16 blocks `/_next` assets from 127.0.0.1.
- Staff identity after seed: organization `acme`, email `staff@local.test`. Password comes from `PHASE1_STAFF_PASSWORD` in `apps/api/.env`. Never invent one. Never print it.
- Wholesale identity: organization `acme`, email `wholesale@local.test`. Password is `PHASE1_WHOLESALE_PASSWORD`.
- `pnpm db:seed:phase1` and `pnpm seed:demo` both leave the catalog empty. Rows appear after Product Browser CSV import, not after seed. An empty table with headers is a valid catalog or inventory list.
- Default ports cannot be remapped by this skill. If `:3000` or `:3001` is someone else's process, attach or stop. Do not launch a second stack.
- Vocabulary on screen: `Available (warehouse)` is leftover (`available`). It is not `availableToSell`. `Allocated` is warehouse cover. It is not `committed`. Do not invent ledger math.

## Driving conventions

- Start every recipe from a signed-out or freshly launched stack unless the feature file says otherwise.
- Prefer role + accessible name, then `data-testid`. Do not click coordinates.
- One structural action per command. Snapshot or screenshot after the state change you care about.
- Internal list search uses the `x-table` placeholder as `aria-label`. Catalog and inventory search is `Search SKU or name`.
- Sidebar links live under `navigation` named `Main navigation`, inside the `Workspace` group. If the tree only shows button `DC Workspace` or `Expand navigation`, the rail is collapsed: `click --role button --name "Expand navigation"` or `click --role button --name "DC Workspace"` first, or `goto --path /…`. The CLI sets the viewport to 1440×900 so the rail stays expanded.
- Cleanup stops processes this run started. It must not delete `evidence/`. Teardown stops Compose only when this CLI started it.

## Proof and skip reporting

- Exercise the real UI path. Do not POST `/internal/auth/login` and call that staff login.
- Capture the action and the resulting state.
- UI proof is an ARIA snapshot plus a screenshot that shows `Staff dashboard` or `DC Wholesale`.
- Record the feature id on every artifact (`catalog-list`, `inventory-page`, `purchasing`, `staff-login`, `wholesale-catalog`).
- If a path is unreachable, write the command you ran and the precondition that failed. Do not mark it verified via a different path.
- `/customers`, `/sales`, `/accounting`, `/reports` are `DashboardPlaceholder` pages. They are not mapped as features yet. Reach them from the same nav if you need a smoke click. Do not pretend they are product tables.

## Features

- [Staff login](./staff-login.md) — dialog or `/login`, then `/catalog`.
- [Catalog list](./catalog-list.md) — live `DataTable` via `listInternalProductsTable`. Drive this first.
- [Inventory page](./inventory-page.md) — live `InventoryTable` snapshot (read-only). Drive after catalog or via direct `/inventory`.
- [Purchasing](./purchasing.md) — draft / completed PO explorer.
- [Wholesale catalog](./wholesale-catalog.md) — shop `/products` on :3002.
