"use client";

import { useGetInternalAccountingSummary } from "@dc-inventory/api-client-internal";
import type { AccountingAgingBucket } from "../lib/accounting-types";
import {
  Button,
  DateInput,
  ExplorerView,
  FieldRow,
  Label,
  LabeledField,
} from "@dc-inventory/ui";
import { CalendarDays } from "lucide-react";
import { useCallback, type ReactNode } from "react";
import {
  accountingAsOfFromSearchParams,
  accountingBucketFromSearchParams,
} from "../lib/accounting-url-params";
import { todayIsoDate } from "../lib/customer-accounting-format";
import { useAccountingUrl } from "../lib/use-accounting-url";
import { AccountingAgingStrip } from "./accounting-aging-strip";
import { AccountingKpiStrip } from "./accounting-kpi-strip";
import { AccountingWorkspace } from "./accounting-workspace";

export function AccountingExplorer({ children }: { children: ReactNode }) {
  const { searchRecord, setSharedParams } = useAccountingUrl();
  const asOf = accountingAsOfFromSearchParams(searchRecord);
  const activeBucket = accountingBucketFromSearchParams(searchRecord);
  const today = todayIsoDate();
  const isToday = asOf === today;

  const summaryQuery = useGetInternalAccountingSummary({ asOf });
  const summary =
    summaryQuery.data?.status === 200 ? summaryQuery.data.data : undefined;

  const onAsOfChange = useCallback(
    (value: string) => {
      setSharedParams({
        asOf: value === today ? null : value,
      });
    },
    [setSharedParams, today],
  );

  const onBucketChange = useCallback(
    (bucket: AccountingAgingBucket | null) => {
      setSharedParams({ bucket });
    },
    [setSharedParams],
  );

  return (
    <ExplorerView className="min-h-[calc(100vh-12rem)]">
      <ExplorerView.Header>
        <header
          className="mt-2 flex flex-col gap-region sm:flex-row sm:items-start sm:justify-between"
          data-testid="accounting-page-header"
        >
          <div className="max-w-2xl">
            <p className="text-label text-fg-secondary">Accounting</p>
            <h1 className="page-title mt-1">Accounts receivable</h1>
            <p className="page-description mt-2">
              Who owes us, who is late, what came in. Record payments and
              adjustments on the customer Accounting tab.
            </p>
          </div>
          <FieldRow className="shrink-0">
            <LabeledField className="w-52 shrink-0">
              <Label htmlFor="accounting-asof">As of</Label>
              <div className="flex items-center gap-action">
                <DateInput
                  id="accounting-asof"
                  density="compact"
                  value={asOf}
                  max={today}
                  onChange={onAsOfChange}
                  className="w-52 shrink-0"
                  data-testid="accounting-asof"
                />
                {!isToday ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onAsOfChange(today)}
                  >
                    <CalendarDays className="size-icon-sm" aria-hidden />
                    Today
                  </Button>
                ) : null}
              </div>
            </LabeledField>
          </FieldRow>
        </header>
      </ExplorerView.Header>
      <ExplorerView.Content>
        <div className="flex min-h-0 flex-1 flex-col gap-form-section">
          {summaryQuery.isLoading ? (
            <p className="text-body-sm text-fg-secondary">Loading summary…</p>
          ) : summaryQuery.isError || !summary ? (
            <p className="text-body-sm text-error">
              Could not load accounting summary.
            </p>
          ) : (
            <>
              <AccountingKpiStrip summary={summary} />
              <AccountingAgingStrip
                aging={summary.aging}
                totalOpenArCents={summary.totalOpenArCents}
                activeBucket={activeBucket}
                onBucketChange={onBucketChange}
              />
            </>
          )}
          <AccountingWorkspace>{children}</AccountingWorkspace>
        </div>
      </ExplorerView.Content>
    </ExplorerView>
  );
}
