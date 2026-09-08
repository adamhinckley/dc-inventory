import { OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import { SellWindowId } from "../domain/ids.js";
import type { SellWindow, SellWindowFilterSnapshot } from "../domain/sell-window.js";

function parseFilterSnapshot(value: unknown): SellWindowFilterSnapshot {
  if (value === null || typeof value !== "object") {
    return {};
  }
  const snapshot = value as Record<string, unknown>;
  return {
    ...(typeof snapshot.q === "string" ? { q: snapshot.q } : {}),
    ...(Array.isArray(snapshot.category)
      ? { category: snapshot.category.filter((item): item is string => typeof item === "string") }
      : {}),
    ...(Array.isArray(snapshot.supplierId)
      ? {
          supplierId: snapshot.supplierId.filter(
            (item): item is string => typeof item === "string",
          ),
        }
      : {}),
    ...(Array.isArray(snapshot.excludeSupplierId)
      ? {
          excludeSupplierId: snapshot.excludeSupplierId.filter(
            (item): item is string => typeof item === "string",
          ),
        }
      : {}),
  };
}

export type SellWindowRow = {
  id: string;
  organizationId: string;
  name: string;
  filterSnapshot: unknown;
  windowOpensAt: Date | null;
  windowClosesAt: Date;
  status: string;
  manuallyClosedAt: Date | null;
  appliedBy: string;
  appliedAt: Date;
  skuCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export function toSellWindow(row: SellWindowRow): SellWindow {
  const status =
    row.status === "scheduled" || row.status === "open" || row.status === "closed"
      ? row.status
      : "closed";
  return {
    id: SellWindowId.parse(row.id),
    organizationId: OrganizationId.parse(row.organizationId),
    name: row.name,
    filterSnapshot: parseFilterSnapshot(row.filterSnapshot),
    windowOpensAt: row.windowOpensAt,
    windowClosesAt: row.windowClosesAt,
    status,
    manuallyClosedAt: row.manuallyClosedAt,
    appliedBy: StaffUserId.parse(row.appliedBy),
    appliedAt: row.appliedAt,
    skuCount: row.skuCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
