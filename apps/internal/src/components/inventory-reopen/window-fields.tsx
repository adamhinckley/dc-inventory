"use client";

import { DateRangeInput, Label, LabeledField } from "@dc-inventory/ui";
import {
  isIsoCalendarDate,
  localTodayISO,
  sellWindowDateRangeMessage,
} from "../../lib/inventory-reopen-workflow";

export function WindowFields({
  opensAt,
  closesAt,
  onOpensAt,
  onClosesAt,
  readOnly = false,
  constrainToFuture = false,
}: {
  opensAt: string;
  closesAt: string;
  onOpensAt: (value: string) => void;
  onClosesAt: (value: string) => void;
  readOnly?: boolean;
  constrainToFuture?: boolean;
}) {
  const today = localTodayISO();
  const rangeError = constrainToFuture
    ? sellWindowDateRangeMessage(opensAt, closesAt, today)
    : opensAt !== "" && closesAt !== "" && closesAt < opensAt
      ? "Close date must be on or after the open date"
      : null;
  const showError = constrainToFuture
    ? opensAt !== "" && closesAt !== "" && rangeError !== null
    : rangeError !== null;

  return (
    <LabeledField className="w-64 shrink-0">
      <Label htmlFor="sell-window-dates">Sell window</Label>
      <DateRangeInput
        id="sell-window-dates"
        density="compact"
        value={{
          from: opensAt === "" ? undefined : opensAt,
          to: closesAt === "" ? undefined : closesAt,
        }}
        onChange={(next) => {
          onOpensAt(isIsoCalendarDate(next.from) ? next.from : "");
          onClosesAt(isIsoCalendarDate(next.to) ? next.to : "");
        }}
        min={constrainToFuture && !readOnly ? today : undefined}
        max="2040-12-31"
        showHint={false}
        showPresets={false}
        disabled={readOnly}
        placeholder="Open – Close"
        data-testid="sell-window-dates"
        data-invalid={showError || undefined}
      />
      {showError ? (
        <p className="text-body-sm text-error" role="alert">
          {rangeError}
        </p>
      ) : null}
    </LabeledField>
  );
}
