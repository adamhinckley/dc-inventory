# Linear work tracking

All Linear **projects**, **issues**, and **sub-initiatives** for this product — including those created from **Cursor** — belong on the **DC Inventory** initiative:

[https://linear.app/adamhinckley/initiative/dc-inventory-41579ab5d46f/overview](https://linear.app/adamhinckley/initiative/dc-inventory-41579ab5d46f/overview)

Do not create a Cursor/Linear project, issue, or sub-initiative for `dc-inventory` outside this initiative.

## Rules

1. **Projects.** When creating a Linear project, add it to the DC Inventory initiative (`addInitiatives` / `setInitiatives`: `DC Inventory`, or the slug `dc-inventory-41579ab5d46f`).
2. **Issues.** Put every Linear issue in a project that is already on that initiative. Issues do not attach to an initiative directly; they show up there through their project. Do not leave issues with no project, and do not use a project that is not on DC Inventory.
3. **Sub-initiatives.** When creating a Linear initiative that is a slice of this product, set its parent to DC Inventory (`parentInitiatives`: `DC Inventory`, or the slug `dc-inventory-41579ab5d46f`). Nested work still lives under this initiative; do not create a sibling top-level initiative for `dc-inventory`.
4. **Team.** Create issues on the **Adam Hinckley** team unless a ticket says otherwise.
5. **Implementation tickets.** Write the work-packet shape in [`AGENTS.md`](../AGENTS.md) (Context, Allowed / forbidden, Given with file or symbol names, Do, observable Done) before `ready-for-agent`. Cite the existing port or HTTP shape, or write `none exists`. Linear-block when another ticket still produces the Given. Grilling and map issues stay questions/decisions, not this shape.

Existing work on the initiative (for example the **Database mapping** project) is the default home for related issues. Create a new project or sub-initiative on DC Inventory only when the work is a distinct outcome, not a one-off ticket.

## Scaffold (architecture §13 step 1)

Intended as a **Scaffold** sub-initiative under DC Inventory. The workspace plan does not currently allow nested initiatives, so these projects attach **directly** to DC Inventory instead:

| Project | Role |
|---|---|
| [Scaffold — Backend](https://linear.app/adamhinckley/project/scaffold-backend-43a46702b7e7) | Monorepo root, shared kernel, Fastify, OpenAPI/Orval, Drizzle wiring |
| [Scaffold — Frontend](https://linear.app/adamhinckley/project/scaffold-frontend-ebcc04a0da47) | `apps/internal` + `apps/wholesale`, UI packages, Storybook |

Frontend depends on Backend. Decisions: `CONTEXT.md`, `docs/adr/0001`–`0007`. When nested initiatives become available, re-parent these projects under a Scaffold sub-initiative without renaming them.

## Product

| Project | Role |
|---|---|
| [Multi-organization](https://linear.app/adamhinckley/project/multi-organization-c54d6b9bb02b) | `OrganizationId` seam. Isolation, not sellability math. |
| [Demand model — backend](https://linear.app/adamhinckley/project/demand-model-backend-c0810f4afefe) | David's available-to-sell formula. Open vs locked per SKU. Ledger + sales confirm. No frontend. Map: [ADA-173](https://linear.app/adamhinckley/issue/ADA-173/demand-model-backend-implementation-map). ADR 0008. |
| [Procurement hub](https://linear.app/adamhinckley/project/procurement-hub-d67ec358231d) | Pre-order worksheet, To Order gap, factory PO drafting. Staff language: Pre-order / To Order / Pre-sold. Map: [ADA-367](https://linear.app/adamhinckley/issue/ADA-367/procurement-hub-implementation-map). Code rename fast-follow: ADA-373. |
| [Shopify channel](https://linear.app/adamhinckley/project/shopify-channel-86c419ea2311) | External hub: push `availableToSell` to Shopify; ingest retail vs Faire orders. Native Faire API stays deferred. Map: [ADA-265](https://linear.app/adamhinckley/issue/ADA-265/shopify-channel-implementation-map). ADR 0009. After Demand model + Sales confirm. |
| [Sep 7 walkthrough follow-ups](https://linear.app/adamhinckley/project/sep-7-walkthrough-follow-ups-1a0ba03008a2) | Planning only. A1–A15 from the 2026-09-07 David walkthrough. Map: [ADA-327](https://linear.app/adamhinckley/issue/ADA-327/sep-7-walkthrough-planning-map-a1-a15). Children are grilling, not `ready-for-agent`. |
| [Accounting — AR](https://linear.app/adamhinckley/project/accounting-ar-526c97835475) | Customer Accounting tab, `/accounting` AR summary, customer-level payments, unapplied credit, adjustments, payment plan, `accounting` role, credit check at confirm. Spec: [`accounting.md`](./accounting.md). Grilled on [ADA-328](https://linear.app/adamhinckley/issue/ADA-328/a1-what-ar-jobs-does-the-customer-accounting-screen-own). Owner-gated tests first (ADA-357). No GL. |
