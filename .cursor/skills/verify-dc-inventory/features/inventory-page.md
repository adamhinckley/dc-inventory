# Inventory page

Inventory in the staff nav is still a placeholder. The route exists so agents can reach it. It must not write `available` or `availableToSell`. Stock movements stay in the Inventory module, not this page.

## Sub-features

- `inventory-nav` reaches `/inventory` from `Main navigation`.
- `inventory-placeholder` shows title `Inventory` and the placeholder body about leftover vs movements.
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
- **Read copy.** Heading `Inventory`. Body includes `Placeholder inventory. Stock movements stay in Inventory — this page will not mutate available.`
- **Proof of placeholder.** `snapshot --aria --path .cursor/skills/verify-dc-inventory/evidence/inventory-page/placeholder.aria.yml` and `screenshot --path .cursor/skills/verify-dc-inventory/evidence/inventory-page/placeholder.png`. Artifacts show the heading and that sentence. They must not show a stock grid pretending to be done.
- **No writer.** Snapshot has no spinbutton or textbox for on-hand / available. If a later ticket ships a real table, `/maintain-verification-skill` updates this file. Do not implement that table from this skill.

## Gotchas

- ADA-221 (inventory page product work) is out of scope for this skill. A missing table is expected.
- `available` on a future table is leftover. `availableToSell` is a different number and is not stored. Do not print a homemade ATP figure.
- Catalog's `Available` column is not this page. Reaching Catalog does not verify Inventory.
- Placeholder copy is the observable end state today. Treat a sudden DataTable here as a product change, not a skill bug, and refresh the map.
