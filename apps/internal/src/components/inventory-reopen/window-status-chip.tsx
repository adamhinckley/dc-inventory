"use client";

import { Chip } from "@dc-inventory/ui";
import type { CSSProperties } from "react";
import type { SellWindowStatus } from "../../lib/inventory-reopen-workflow";

const STATUS_PRESENTATION: Record<
  SellWindowStatus,
  { label: string; color: string }
> = {
  open: { label: "Open", color: "var(--color-success)" },
  scheduled: { label: "Scheduled", color: "var(--color-info)" },
  closed: { label: "Closed", color: "var(--color-error)" },
};

export function WindowStatusChip({ status }: { status: SellWindowStatus }) {
  const presentation = STATUS_PRESENTATION[status];
  return (
    <Chip
      icon={<Chip.Dot />}
      style={{ "--chip-color": presentation.color } as CSSProperties}
    >
      {presentation.label}
    </Chip>
  );
}
