import type { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import type { SellWindowId } from "./ids.js";

export type SellWindowStatus = "scheduled" | "open" | "closed";

/** Staff product-list filters captured when the window was applied. */
export type SellWindowFilterSnapshot = {
  q?: string;
  category?: readonly string[];
  supplierId?: readonly string[];
  excludeSupplierId?: readonly string[];
};

export type SellWindow = {
  id: SellWindowId;
  organizationId: OrganizationId;
  name: string;
  filterSnapshot: SellWindowFilterSnapshot;
  windowOpensAt: Date | null;
  windowClosesAt: Date;
  status: SellWindowStatus;
  manuallyClosedAt: Date | null;
  appliedBy: StaffUserId;
  appliedAt: Date;
  skuCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type SellWindowTiming = {
  windowOpensAt: Date | null;
  windowClosesAt: Date;
  manuallyClosedAt: Date | null;
};

export function computeSellWindowStatus(timing: SellWindowTiming, now: Date): SellWindowStatus {
  if (timing.manuallyClosedAt !== null) {
    return "closed";
  }
  if (now >= timing.windowClosesAt) {
    return "closed";
  }
  if (timing.windowOpensAt !== null && now < timing.windowOpensAt) {
    return "scheduled";
  }
  return "open";
}
