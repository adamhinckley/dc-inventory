# Future concepts

Design notes for capabilities that are **not v1**, but must not force a rewrite when they land.

These are not work packets. Do not implement them in Catalog, Inventory, or Identity slices unless the owner explicitly opens that packet.

| Note | v1 stance |
| --- | --- |
| [`multi-organization.md`](./multi-organization.md) | One wholesale company per deploy. Leave an `OrganizationId` seam (like `LocationId`). |

Related current contract: [`../architecture.md`](../architecture.md) · [`../stack.md`](../stack.md) · [`../database-design.md`](../database-design.md) · [`../open-questions.md`](../open-questions.md) · [`../surfaces/`](../surfaces/). Tax **calculation** is v1 — [`../tax.md`](../tax.md). [`../tax-engine.md`](../tax-engine.md) is an earlier design note.
