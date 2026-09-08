import type { MatchFilters, MockSku, SellWindow, SellWindowStatus } from "./types";

export function parseDay(value: string): Date | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }
  const parts = trimmed.split("-");
  if (parts.length !== 3) {
    return null;
  }
  const [year, month, day] = parts.map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }
  return new Date(year, month - 1, day);
}

export function isWindowActive(window: SellWindow, now: Date): boolean {
  if (window.status === "closed" || window.manuallyClosedAt !== null) {
    return false;
  }
  const opens = new Date(window.opensAt);
  const closes = new Date(window.closesAt);
  return now >= opens && now < closes;
}

export function deriveWindowStatus(window: SellWindow, now: Date): SellWindowStatus {
  if (window.status === "closed" || window.manuallyClosedAt !== null) {
    return "closed";
  }
  const opens = new Date(window.opensAt);
  const closes = new Date(window.closesAt);
  if (now < opens) {
    return "scheduled";
  }
  if (now >= closes) {
    return "closed";
  }
  return "open";
}

export function effectiveSellState(
  sku: MockSku,
  windows: SellWindow[],
  now: Date,
): "open" | "locked" {
  const anyActive = windows.some(
    (window) => sku.windowIds.includes(window.id) && isWindowActive(window, now),
  );
  if (anyActive) {
    return "open";
  }
  return "locked";
}

export function isHiddenUntilWindowOpen(
  sku: MockSku,
  windows: SellWindow[],
  now: Date,
): boolean {
  if (sku.inactive || sku.discontinued) {
    return false;
  }
  const memberships = windows.filter((window) => sku.windowIds.includes(window.id));
  if (memberships.length === 0) {
    return false;
  }
  const hasActive = memberships.some((window) => isWindowActive(window, now));
  if (hasActive) {
    return false;
  }
  const hasFuture = memberships.some((window) => {
    if (window.status === "closed" || window.manuallyClosedAt) {
      return false;
    }
    return now < new Date(window.opensAt);
  });
  return hasFuture;
}

export function activeWindowNames(sku: MockSku, windows: SellWindow[], now: Date): string[] {
  return windows
    .filter((window) => sku.windowIds.includes(window.id) && isWindowActive(window, now))
    .map((window) => window.name);
}

export function matchesFilters(sku: MockSku, filters: MatchFilters): boolean {
  if (filters.categories.length > 0) {
    const hasCategory = filters.categories.some((category) => sku.categories.includes(category));
    if (!hasCategory) {
      return false;
    }
  }
  if (filters.excludeSuppliers.includes(sku.supplierId)) {
    return false;
  }
  if (filters.search.trim() !== "") {
    const needle = filters.search.trim().toLowerCase();
    if (
      !sku.sku.toLowerCase().includes(needle) &&
      !sku.name.toLowerCase().includes(needle)
    ) {
      return false;
    }
  }
  return true;
}

export function eligibleForBulkApply(sku: MockSku): boolean {
  return !sku.inactive && !sku.discontinued;
}

export function shopVisible(sku: MockSku, windows: SellWindow[], now: Date): boolean {
  if (sku.inactive || sku.discontinued) {
    return false;
  }
  if (isHiddenUntilWindowOpen(sku, windows, now)) {
    return false;
  }
  const state = effectiveSellState(sku, windows, now);
  if (state === "open") {
    return true;
  }
  return sku.onHand + sku.onOrder > 0;
}
