"use client";

import { Chip } from "@dc-inventory/ui";
import type { SellWindowStatus } from "../../lib/inventory-reopen-workflow";

const STATUS_LABEL: Record<SellWindowStatus, string> = {
  scheduled: "Scheduled",
  open: "Open",
  closed: "Closed",
};

const STATUS_COLOR: Record<SellWindowStatus, string> = {
  scheduled: "[--chip-color:var(--color-status-pending)]",
  open: "[--chip-color:var(--color-status-open)]",
  closed: "[--chip-color:var(--color-fg-secondary)]",
};

export function WindowStatusChip({ status }: { status: SellWindowStatus }) {
  return (
    <Chip icon={<Chip.Dot />} className={STATUS_COLOR[status]}>
      {STATUS_LABEL[status]}
    </Chip>
  );
}
