"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { ListQueryParams, TableMeta } from "@dc-inventory/ui-internal";
import {
  accountingPathWithQuery,
  accountingTabHref,
  applyAccountingSharedPatch,
  applyAccountingTableParams,
  type AccountingSharedPatch,
} from "./accounting-url-params";
import { searchParamsToRecord } from "./table-url-params";

export function useAccountingUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchRecord = useMemo(
    () => searchParamsToRecord(searchParams),
    [searchParams],
  );

  const setSharedParams = useCallback(
    (patch: AccountingSharedPatch) => {
      const nextRecord = applyAccountingSharedPatch(searchRecord, patch, pathname);
      router.replace(accountingPathWithQuery(pathname, nextRecord), {
        scroll: false,
      });
    },
    [pathname, router, searchRecord],
  );

  const setTableParams = useCallback(
    (meta: TableMeta, params: ListQueryParams) => {
      const nextRecord = applyAccountingTableParams(
        searchRecord,
        pathname,
        meta,
        params,
      );
      router.replace(accountingPathWithQuery(pathname, nextRecord), {
        scroll: false,
      });
    },
    [pathname, router, searchRecord],
  );

  const tabHref = useCallback(
    (targetPath: string) => accountingTabHref(targetPath, searchRecord),
    [searchRecord],
  );

  return {
    pathname,
    searchRecord,
    setSharedParams,
    setTableParams,
    tabHref,
  };
}
