"use client";

import { DateInput, FieldRow, LabeledField, Label } from "@dc-inventory/ui";

export function WindowDateFields({
  opensAt,
  closesAt,
  onOpensAt,
  onClosesAt,
  readOnly = false,
}: {
  opensAt: string;
  closesAt: string;
  onOpensAt: (value: string) => void;
  onClosesAt: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <FieldRow className="items-start">
      <LabeledField className="min-w-56">
        <Label htmlFor="window-opens">Opens</Label>
        <DateInput
          id="window-opens"
          density="compact"
          className="w-52"
          value={opensAt}
          onChange={onOpensAt}
          yearNavigation
          placeholder="Optional — starts now"
          aria-label="Window opens"
          disabled={readOnly}
        />
        <p className="text-body-sm text-fg-secondary">
          Wholesale infinity begins on this date. Leave empty to open immediately when you apply.
        </p>
      </LabeledField>
      <LabeledField className="min-w-56">
        <Label htmlFor="window-closes">Closes</Label>
        <DateInput
          id="window-closes"
          density="compact"
          className="w-52"
          value={closesAt}
          onChange={onClosesAt}
          yearNavigation
          placeholder="Required"
          aria-label="Window closes"
          disabled={readOnly}
        />
        <p className="text-body-sm text-fg-secondary">
          Required. Infinity stops after this date, or use Close Infinity to end early.
        </p>
      </LabeledField>
    </FieldRow>
  );
}
