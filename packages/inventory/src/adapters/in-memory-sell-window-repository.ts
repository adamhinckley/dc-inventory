import { OrganizationId, type Sku } from "@dc-inventory/shared-kernel";
import type { SellWindowId } from "../domain/ids.js";
import type { SellWindow } from "../domain/sell-window.js";
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
}
