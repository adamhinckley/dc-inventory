# Catalog list

Catalog is the live staff product table. It reads `listInternalProductsTable` + `useListInternalProducts`. It does not write stock. Inventory leftover on this page is the `Available` column, not available-to-sell.

## Sub-features

- `catalog-open` shows heading `Catalog` and the help tooltip (`data-testid="catalog-page-help"`).
- `catalog-table` renders column headers from `x-table`: SKU, Name, Member price, Currency, Inactive, Discontinued, Web wholesale, On hand, On order, Allocated, Available, Case qty, Created.
- `catalog-search` filters through the textbox named `Search SKU or name` (`q`).
- `catalog-empty` shows `No results.` when seed left the catalog empty.
- `catalog-import-open` opens `Import Product Browser` (`data-testid="catalog-import-dialog-trigger"`). Do not commit an import unless the ticket is about import.

## How to get to it (user POV)

- Sign in. The app redirects `/` to `/catalog`.
- Choose `Catalog` in `Main navigation`.
- Brand mark `Home` also goes to `/catalog`.

## Driving it with control-dc-inventory

Preconditions:

- Staff session is valid (`login-staff` already succeeded, or run it).
- `control doctor` is green for `internal` + `api`.
- Expect an empty table after `db:seed:phase1` or `seed:demo`. Both skip product persist (`persistCatalog: false` on the demo CLI). `No results.` is success, not a broken table.

- **Open catalog.** Run `goto --path /catalog` then `wait-settle`. Heading `Catalog` is present. Top bar still reads `Staff dashboard`.
- **Nav entry.** From `/inventory` or `/purchasing`, run `click --role link --name Catalog`. URL is `/catalog`. If the link is missing, the Workspace group is collapsed: `click --role button --name "DC Workspace"` only when the snapshot does not already list Catalog.
- **Read the grid.** Run `snapshot --aria --path .cursor/skills/verify-dc-inventory/evidence/catalog-list/table.aria.yml`. The tree includes the search textbox `Search SKU or name`, button `Import Product Browser`, and columnheaders `SKU`, `Name`, `Available`, `Allocated`. `Available` help text (if open) says leftover is on hand minus allocated and is not available to sell.
- **Empty seed.** If no Product Browser import has run, the table empty state is `No results.` (`DataTable` `emptyMessage` is `No rows`; the table primitive shows `No results.`). Do not invent SKUs such as `HEX-BOLT-GALV` as proof of seed. Those strings live in `phase1-fixture.ts` but phase 1 does not write products.
- **Search (empty book).** `fill --role textbox --name "Search SKU or name" --value HEX` then `wait-settle`. Still `No results.` URL may gain `q=HEX`. Clear by filling `""` or `goto --path /catalog`.
- **Search (after a real import).** Same fill. Matching SKU or name cells appear. This path is optional and not required to mark `catalog-list` proved.
- **Proof.** `screenshot --path .cursor/skills/verify-dc-inventory/evidence/catalog-list/table.png`. The image shows the Catalog heading, search field, and the table (empty or populated).

## Gotchas

- `Available` ≠ `availableToSell`. The table has no available-to-sell column. Do not compute one in the skill.
- `Allocated` ≠ `committed`. The table does not show committed.
- Catalog does not mutate on-hand. Receiving a PO or posting an adjustment does. The heading tooltip says so.
- Import `Check file` is a dry-run. `Import` writes. Leave both alone unless you are verifying import. Quantity columns in the CSV are ignored by the importer.
- Do not use a hand-written `fetch` to `/internal/products` as proof of this page.
