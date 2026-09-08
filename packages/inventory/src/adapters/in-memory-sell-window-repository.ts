import { OrganizationId, Sku, StaffUserId } from "@dc-inventory/shared-kernel";
import { SellWindowId } from "../domain/ids.js";
import {
  computeSellWindowStatus,
  type SellWindow,
  type SellWindowFilterSnapshot,
} from "../domain/sell-window.js";
import type {
  CreateSellWindowRecord,
  ISellWindowRepository,
  ListSellWindowsQuery,
  SellWindowDetail,
  SellWindowListPage,
} from "../domain/ports/sell-window-repository.js";

function compareWindows(
  a: SellWindow,
  b: SellWindow,
  sortBy: ListSellWindowsQuery["sortBy"],
  sortOrder: ListSellWindowsQuery["sortOrder"],
): number {
  let cmp = 0;
  if (sortBy === "name") {
    cmp = a.name.localeCompare(b.name);
  } else if (sortBy === "status") {
    cmp = a.status.localeCompare(b.status);
  } else if (sortBy === "windowOpensAt") {
    cmp = (a.windowOpensAt?.getTime() ?? 0) - (b.windowOpensAt?.getTime() ?? 0);
  } else if (sortBy === "windowClosesAt") {
    cmp = a.windowClosesAt.getTime() - b.windowClosesAt.getTime();
  } else {
    cmp = a.appliedAt.getTime() - b.appliedAt.getTime();
  }
  return sortOrder === "desc" ? -cmp : cmp;
}

function cloneWindow(window: SellWindow): SellWindow {
  return { ...window, filterSnapshot: { ...window.filterSnapshot } };
}

export class InMemorySellWindowRepository implements ISellWindowRepository {
  private readonly windows = new Map<SellWindowId, SellWindow>();
  private readonly skusByWindow = new Map<SellWindowId, Sku[]>();

  async create(record: CreateSellWindowRecord): Promise<void> {
    this.windows.set(record.window.id, cloneWindow(record.window));
    this.skusByWindow.set(record.window.id, [...record.skus]);
  }

  async list(query: ListSellWindowsQuery): Promise<SellWindowListPage> {
    const rows = [...this.windows.values()].filter(
      (window) => window.organizationId === query.organizationId,
    );
    rows.sort((a, b) => compareWindows(a, b, query.sortBy, query.sortOrder));
    const start = (query.page - 1) * query.pageSize;
    return {
      items: rows.slice(start, start + query.pageSize).map(cloneWindow),
      total: rows.length,
    };
  }

  async findById(
    organizationId: OrganizationId,
    id: SellWindowId,
  ): Promise<SellWindowDetail | null> {
    const window = this.windows.get(id);
    if (window === undefined || window.organizationId !== organizationId) {
      return null;
    }
    const skus = this.skusByWindow.get(id) ?? [];
    return {
      ...cloneWindow(window),
      skus: [...skus],
    };
  }

  async close(
    organizationId: OrganizationId,
    id: SellWindowId,
    manuallyClosedAt: Date,
  ): Promise<SellWindow | null> {
    const window = this.windows.get(id);
    if (window === undefined || window.organizationId !== organizationId) {
      return null;
    }
    const closed: SellWindow = {
      ...cloneWindow(window),
      manuallyClosedAt,
      status: "closed",
      updatedAt: manuallyClosedAt,
    };
    this.windows.set(id, closed);
    return cloneWindow(closed);
  }

  /** Test helper: refresh derived status from clock without mutating manually closed rows. */
  refreshStatuses(now: Date): void {
    for (const [id, window] of this.windows) {
      if (window.manuallyClosedAt !== null) {
        continue;
      }
      const status = computeSellWindowStatus(window, now);
      if (status !== window.status) {
        this.windows.set(id, { ...cloneWindow(window), status, updatedAt: now });
      }
    }
  }
}

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

export function toSellWindow(row: {
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
}): SellWindow {
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
