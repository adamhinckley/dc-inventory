# `@dc-inventory/ui-internal`

Staff-dashboard **DataTable** and Recharts wrappers for `apps/internal`. Token classes come from `@dc-inventory/ui` (`section-flat`, `text-fg`). Wholesale shop and ops must not import this package.

## What lives here

- `data-table/` — compound `DataTable.Root` + slots (`Search`, `Filters`, `Table`, `Pagination`) per [`docs/api-contract.md`](../../docs/api-contract.md). `meta` is the generated `x-table` shape. Chrome only renders filters listed on that meta. The page injects an Orval `queryHook` and optional URL adapter (`initialParams` + `onParamsChange`).
- `charts/report-chart/` — Recharts stub for later `x-chart` report hooks. Series colors are `--color-chart-*` tokens (Okabe–Ito). No raw hex.

`src/index.ts` is re-exports only. Edit the surface folder, not the package barrel.

## How to consume

```tsx
import { DataTable } from "@dc-inventory/ui-internal";
import { useListInternalProducts } from "@dc-inventory/api-client-internal";

<DataTable.Root
  meta={productsListTable}
  queryHook={useListInternalProducts}
  initialParams={initialParams}
  onParamsChange={onParamsChange}
>
  <DataTable.Search />
  <DataTable.Filters />
  <DataTable.Table />
  <DataTable.Pagination />
</DataTable.Root>
```

`queryHook` is an Orval TanStack Query hook. `useDataTable` unwraps `{ data, status, headers }` from `customFetch` to `{ items, page, pageSize, total }`.

URL keys stay in the app (`history.replaceState`). Do not import `useSearchParams` here.

Adding a filter is a **backend** change (Zod + `x-table` + `pnpm gen:api`). Do not invent filter controls in this package.

## Storybook

From the repo root:

```bash
pnpm storybook
```

Stories: `ui-internal/DataTable` (in-memory mock, no URL adapter) and `ui-internal/ReportChart`.

## How to test

```bash
pnpm --filter @dc-inventory/ui-internal test
pnpm --filter @dc-inventory/ui-internal typecheck
```
