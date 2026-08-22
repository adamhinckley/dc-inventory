# `@dc-inventory/ui-internal`

Staff-dashboard **DataTable** and Recharts wrappers for `apps/internal`.

Wholesale shop and ops must not import this package. `DataTable` is not a catalog.

## What lives here

- `DataTable` — `{ meta, queryHook }` per [`docs/api-contract.md`](../../docs/api-contract.md). `meta` is the generated `x-table` shape (`columns`, `search`, `filters`, `sort`). The chrome only renders filters listed on that meta.
- `ReportChart` — Recharts stub for later `x-chart` report hooks. Series colors are `--color-chart-*` tokens (Okabe–Ito). No raw hex.

## How to consume

```tsx
import { DataTable, ReportChart } from "@dc-inventory/ui-internal";
import { useListInternalProducts } from "@dc-inventory/api-client-internal";
import { productsListTable } from "./generated/productsListTable";

<DataTable meta={productsListTable} queryHook={useListInternalProducts} />
```

`queryHook` is an Orval TanStack Query hook. `DataTable` unwraps `{ data: { items, page, pageSize, total } }`.

Adding a filter is a **backend** change (Zod + `x-table` + `pnpm gen:api`). Do not invent filter controls in this package.

## Storybook

From the repo root:

```bash
pnpm storybook
```

Stories: `ui-internal/DataTable` (mock products `x-table`) and `ui-internal/ReportChart`.

## How to test

```bash
pnpm --filter @dc-inventory/ui-internal test
pnpm --filter @dc-inventory/ui-internal typecheck
```
