# Inventory page

Live staff inventory snapshot. `InventoryHeading` plus `InventoryTable` (`listInternalProducts` display fields). Read-only: no receive, adjust, or transfer controls. Quantities come from the API response; do not invent ATP or warehouse math in this skill.

## Sub-features

- `inventory-nav` reaches `/inventory` from `Main navigation`.
- `inventory-heading` shows title `Inventory` and help `data-testid="inventory-page-help"`.
- `inventory-table` is a `DataTable` with search and optional hide-zero filter.
- `inventory-no-mutate` has no quantity editor and no save control.

## How to get to it (user POV)

- Sign in.
- Choose `Inventory` in `Main navigation`.
- Or open `http://localhost:3000/inventory`.

## Driving it with control-dc-inventory

Preconditions:

- Staff session is valid.
- `control doctor` is green for `internal`.

- **Open from nav.** From `/catalog`, run `click --role link --name Inventory` then `wait-settle`. URL is `/inventory`. Use `goto --path /inventory` if the Workspace group is collapsed.
- **Direct path.** `goto --path /inventory` then `wait-settle`. Same page.
- **Read heading.** `getByRole('heading', { name: 'Inventory' })`. Help tooltip uses `data-testid="inventory-page-help"`.
- **Read table.** Column headers (API display fields): `SKU`, `Name`, `On hand`, `On order`, `Allocated`, `Committed (pre-sold)`, `Available (warehouse)`, `Available to sell`, `Sell state`. Search placeholder is `Search SKU or name`.
- **Empty catalog.** After phase1/demo seed the catalog is empty, so the table shows `No results.` with headers visible. That is valid proof.
- **Proof.** `snapshot --aria --path .cursor/skills/verify-dc-inventory/evidence/inventory-page/table.aria.yml` and `screenshot --path .cursor/skills/verify-dc-inventory/evidence/inventory-page/table.png`. Artifacts must show the inventory table chrome, not a placeholder paragraph.
- **No writer.** Snapshot has no spinbutton or textbox for on-hand / available. Report only values the API returned on screen.

## Gotchas

- `Available (warehouse)` is the `available` field. `Available to sell` is `availableToSell`. They are different numbers. Do not conflate them.
- `Allocated` is warehouse cover. `Committed (pre-sold)` is `committed`. Do not treat them as the same column.
- Catalog's `Available` column is not this page. Reaching Catalog does not verify Inventory.
- Rows appear after Product Browser import (or other catalog inserts), same as Catalog. Seed alone does not add SKUs.
