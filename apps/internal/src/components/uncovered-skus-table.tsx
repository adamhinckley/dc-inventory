"use client";

import { useListInternalUncoveredSkus } from "@dc-inventory/api-client-internal";
import {
  DataTable,
  unwrapListData,
  type ListQueryHook,
  type ListQueryParams,
  type ListQueryResult,
} from "@dc-inventory/ui-internal";
import { useCallback, useMemo } from "react";
import { suggestedDraftPoQty } from "../lib/purchase-order-line-math";
import { replaceTableUrlParams } from "../lib/table-url-params";
import { uncoveredListTable } from "../lib/uncovered-list-table";

type UncoveredListParams = NonNullable<
  Parameters<typeof useListInternalUncoveredSkus>[0]
>;

type UncoveredApiRow = {
  sku: string;
  uncovered: number;
  onHand: number;
  onOrder: number;
  committed: number;
  caseQty: number | null;
  reorderMin: number | null;
  reorderMax: number | null;
};

type UncoveredRow = UncoveredApiRow & {
  suggestedQty: number;
};

function withSuggestedQty(row: UncoveredApiRow): UncoveredRow {
  return {
    ...row,
    suggestedQty: suggestedDraftPoQty(row.uncovered, row.caseQty ?? null),
  };
}

const useUncoveredList: ListQueryHook<UncoveredListParams, UncoveredRow> = (params) => {
  const query = useListInternalUncoveredSkus(params);

  const data = useMemo((): ListQueryResult<UncoveredRow>["data"] => {
    const envelope = unwrapListData(
      query.data as ListQueryResult<UncoveredRow>["data"],
    );
    if (!envelope) {
      return query.data as ListQueryResult<UncoveredRow>["data"];
    }

    const items = envelope.items.map((item) =>
      withSuggestedQty(item as UncoveredApiRow),
    );

    const orval = query.data;
    if (
      orval &&
      typeof orval === "object" &&
      "data" in orval &&
      orval.data &&
      typeof orval.data === "object" &&
      "items" in orval.data
    ) {
      return {
        ...orval,
        data: {
          ...orval.data,
          items,
        },
      } as ListQueryResult<UncoveredRow>["data"];
    }

    return {
      ...envelope,
      items,
    };
  }, [query.data]);

  return {
    ...query,
    data,
  };
};

export function UncoveredSkusTable({
  initialParams,
}: {
  initialParams?: ListQueryParams;
}) {
  const onParamsChange = useCallback((params: ListQueryParams) => {
    replaceTableUrlParams(uncoveredListTable, params);
  }, []);

  return (
    <DataTable.Root<UncoveredListParams, UncoveredRow>
      meta={uncoveredListTable}
      queryHook={useUncoveredList}
      initialParams={initialParams}
      onParamsChange={onParamsChange}
      idPrefix="uncovered-skus"
    >
      <DataTable.Table />
      <DataTable.Pagination />
    </DataTable.Root>
  );
}
