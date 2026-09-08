export type SellWindowStatus = "scheduled" | "open" | "closed";

export type SellWindow = {
  id: string;
  name: string;
  categories: string[];
  excludeSuppliers: string[];
  opensAt: string;
  closesAt: string;
  status: SellWindowStatus;
  skuIds: string[];
  appliedAt: string;
  appliedBy: string;
  manuallyClosedAt: string | null;
};

export type MockSku = {
  sku: string;
  name: string;
  supplierName: string;
  supplierId: string;
  categories: string[];
  inactive: boolean;
  discontinued: boolean;
  onHand: number;
  onOrder: number;
  stickyLocked: boolean;
  windowIds: string[];
};

export type SellWindowsPrototypeState = {
  now: string;
  skus: MockSku[];
  windows: SellWindow[];
  lastAction: string | null;
};

export type MatchFilters = {
  categories: string[];
  excludeSuppliers: string[];
  search: string;
};
