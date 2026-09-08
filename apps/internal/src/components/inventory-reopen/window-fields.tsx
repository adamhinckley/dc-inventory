import { DateInput } from "@dc-inventory/ui";

export function WindowFields({
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
    <div className="flex shrink-0 items-center gap-tight">
      <DateInput
        density="compact"
        className="w-40"
        value={opensAt}
        onChange={onOpensAt}
        yearNavigation
        disabled={readOnly}
        placeholder="Window Opens"
        aria-label="Window Opens"
      />
      <DateInput
        density="compact"
        className="w-40"
        value={closesAt}
        onChange={onClosesAt}
        yearNavigation
        disabled={readOnly}
        placeholder="Window Closes"
        aria-label="Window Closes"
      />
    </div>
  );
}
