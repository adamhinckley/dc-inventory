import { DateInput, FieldRow, Label, LabeledField } from "@dc-inventory/ui";

export function WindowFields({
  opensAt,
  closesAt,
  onOpensAt,
  onClosesAt,
}: {
  opensAt: string;
  closesAt: string;
  onOpensAt: (value: string) => void;
  onClosesAt: (value: string) => void;
}) {
  return (
    <FieldRow>
      <LabeledField className="min-w-56">
        <Label>Window Opens</Label>
        <DateInput value={opensAt} onChange={onOpensAt} yearNavigation />
      </LabeledField>
      <LabeledField className="min-w-56">
        <Label>Window Closes</Label>
        <DateInput value={closesAt} onChange={onClosesAt} yearNavigation />
      </LabeledField>
    </FieldRow>
  );
}
