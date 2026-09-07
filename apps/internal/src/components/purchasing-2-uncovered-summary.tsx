"use client";

import { getListInternalUncoveredFactoriesQueryKey } from "@dc-inventory/api-client-internal";
import { Chip, Table, useTable, type TableColumnDef } from "@dc-inventory/ui";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, type CSSProperties } from "react";
import type { UncoveredFactoryRow } from "../lib/list-all-uncovered-factories";
import { listPurchasing2UncoveredFactories } from "../lib/list-purchasing-2-uncovered-factories";
import {
  isPurchasing2UncoveredNeedsMappingFactoryId,
  purchasing2UncoveredFactoryDetailHref,
} from "../lib/purchasing-2-uncovered-constants";

function FactoryNameCell({ row }: { row: UncoveredFactoryRow }) {
  if (row.needsMapping) {
    return (
      <Link
        href={purchasing2UncoveredFactoryDetailHref(row.id)}
        className="text-link hover:text-link-hover inline-flex min-w-0 items-center gap-field"
      >
        <Chip style={{ "--chip-color": "var(--color-warning)" } as CSSProperties}>
          {row.supplierName}
        </Chip>
      </Link>
    );
  }

  return (
    <Link
      href={purchasing2UncoveredFactoryDetailHref(row.id)}
      className="text-link hover:text-link-hover block min-w-0 truncate font-medium"
    >
      {row.supplierName}
    </Link>
  );
}

function formatFactoryCell(row: UncoveredFactoryRow, field: keyof UncoveredFactoryRow): string {
  const value = row[field];
  if (value === null || value === undefined) {
    return "—";
  }
  return String(value);
}

export function Purchasing2UncoveredSummary() {
  const factoriesQuery = useQuery({
    queryKey: [
      ...getListInternalUncoveredFactoriesQueryKey(),
      "purchasing-2",
      "excludeSuppliersWithOpenDraft",
    ],
    queryFn: () => listPurchasing2UncoveredFactories(),
  });

  const rows = factoriesQuery.data ?? [];
  const busy = factoriesQuery.isPending;

  const columns = useMemo<TableColumnDef<UncoveredFactoryRow>[]>(
    () => [
      {
        id: "supplierName",
        label: "Factory",
        sort: false,
        align: "left",
        flex: 1,
        truncate: true,
        render: ({ record }) => <FactoryNameCell row={record} />,
      },
      {
        id: "supplierNumber",
        label: "Factory #",
        sort: false,
        align: "left",
        render: ({ record }) => formatFactoryCell(record, "supplierNumber"),
      },
      {
        id: "productCount",
        label: "Products",
        sort: false,
        align: "right",
        render: ({ record }) => formatFactoryCell(record, "productCount"),
      },
      {
        id: "totalUncoveredUnits",
        label: "Total uncovered",
        sort: false,
        align: "right",
        render: ({ record }) => formatFactoryCell(record, "totalUncoveredUnits"),
      },
    ],
    [],
  );

  const table = useTable({
    data: rows,
    isPending: busy,
    isError: factoriesQuery.isError === true,
    columns,
    getRowId: (row) => row.id,
    fillColumn: "supplierName",
    enableSorting: false,
    enableSelection: false,
    enablePagination: false,
  });

  const needsMappingCount = rows.filter((row) =>
    isPurchasing2UncoveredNeedsMappingFactoryId(row.id),
  ).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-form-section">
      <p className="text-body-sm text-fg-secondary">
        Factories with uncovered demand that are not yet on an open draft purchase order.
        {needsMappingCount > 0
          ? " The needs-mapping row is read-only until supplier products are assigned."
          : null}
      </p>

      <Table
        sticky
        className="min-h-0 flex-1"
        table={table}
        emptyMessage="No factories waiting for a first draft PO"
      >
        <Table.Header />
        <Table.Body />
        <Table.Empty />
      </Table>
    </div>
  );
}
