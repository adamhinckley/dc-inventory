import type { OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import type { SellWindowId } from "../ids.js";
import type { SellWindow, SellWindowFilterSnapshot } from "../sell-window.js";

export type SellWindowListSortBy =
  | "name"
  | "appliedAt"
  | "windowOpensAt"
  | "windowClosesAt"
  | "status";

export type SortOrder = "asc" | "desc";

export type ListSellWindowsQuery = {
  organizationId: OrganizationId;
  page: number;
  pageSize: number;
  sortBy: SellWindowListSortBy;
  sortOrder: SortOrder;
};

export type SellWindowListPage = {
  items: SellWindow[];
  total: number;
};

export type SellWindowDetail = SellWindow & {
  skus: readonly Sku[];
};

export type CreateSellWindowRecord = {
  window: SellWindow;
  skus: readonly Sku[];
};

export interface ISellWindowRepository {
  create(record: CreateSellWindowRecord): Promise<void>;
  list(query: ListSellWindowsQuery): Promise<SellWindowListPage>;
  findById(organizationId: OrganizationId, id: SellWindowId): Promise<SellWindowDetail | null>;
  close(
    organizationId: OrganizationId,
    id: SellWindowId,
    manuallyClosedAt: Date,
  ): Promise<SellWindow | null>;
}

export function normalizeSellWindowFilterSnapshot(
  snapshot: SellWindowFilterSnapshot,
): SellWindowFilterSnapshot {
  const q = snapshot.q?.trim();
  return {
    ...(q !== undefined && q.length > 0 ? { q } : {}),
    ...(snapshot.category !== undefined && snapshot.category.length > 0
      ? { category: [...snapshot.category] }
      : {}),
    ...(snapshot.supplierId !== undefined && snapshot.supplierId.length > 0
      ? { supplierId: [...snapshot.supplierId] }
      : {}),
    ...(snapshot.excludeSupplierId !== undefined && snapshot.excludeSupplierId.length > 0
      ? { excludeSupplierId: [...snapshot.excludeSupplierId] }
      : {}),
  };
}
