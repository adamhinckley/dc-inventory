# Purchasing

Purchasing is the staff purchase-order explorer: Drafts at `/purchasing`, Completed at `/purchasing/completed`, a new draft at `/purchasing/new`, and suppliers at `/purchasing/suppliers`.

## Sub-features

- `purchasing-drafts` lists draft POs (`list="draft"`).
- `purchasing-completed` switches to the Completed tab.
- `purchasing-new` opens `New draft PO`.
- `purchasing-suppliers` opens `Suppliers`.
- `purchasing-search` uses textbox `Search PO number` when the drafts table is up.

## How to get to it (user POV)

- Sign in.
- Choose `Purchasing` in `Main navigation` → `/purchasing`.
- Eyebrow `Purchasing`, heading `Purchase orders`.
- Tabs `Drafts` and `Completed` (`data-testid="purchasing-orders-router-tabs"`).
- Buttons `Suppliers` and `New draft PO`.

## Driving it with control-dc-inventory

Preconditions:

- Staff session is valid.
- `control doctor` is green for `internal` + `api`.
- Seed may leave zero POs. An empty drafts table is allowed.

- **Open drafts.** `goto --path /purchasing` then `wait-settle`. Heading `Purchase orders`. Description says drafts stay editable and Finalize moves a PO to Completed.
- **Nav entry.** `click --role link --name Purchasing --within-role navigation --within-name "Main navigation"`.
- **Completed tab.** `click --role tab --name Completed` or `goto --path /purchasing/completed`. URL is `/purchasing/completed`.
- **Back to drafts.** `click --role tab --name Drafts` or `goto --path /purchasing`.
- **Suppliers.** `click --role link --name Suppliers`. URL is `/purchasing/suppliers`.
- **New draft.** `click --role link --name "New draft PO"`. URL is `/purchasing/new`. Do not invent line qty or dates. Leave the draft uncommitted unless a purchasing ticket says otherwise.
- **Proof.** From `/purchasing`, `snapshot --aria --path .cursor/skills/verify-dc-inventory/evidence/purchasing/drafts.aria.yml` and `screenshot --path .cursor/skills/verify-dc-inventory/evidence/purchasing/drafts.png`. Artifacts show `Purchase orders`, `Drafts`, `Completed`, and `New draft PO`.

## Gotchas

- ADA-218 (draft-PO columns) is out of scope. Drive the explorer that exists. Do not add columns from this skill.
- Search placeholder is `Search PO number`, not the catalog search.
- Finalize / XLS download live on completed POs. Do not click them on a shared demo database unless you can restore the document.
- This is not the wholesale cart and not Inventory receive.
