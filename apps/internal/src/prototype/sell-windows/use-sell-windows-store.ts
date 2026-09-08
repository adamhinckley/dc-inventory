"use client";

import { useCallback, useMemo, useState } from "react";
import {
  deriveWindowStatus,
  eligibleForBulkApply,
  matchesFilters,
  parseDay,
} from "./logic";
import { INITIAL_SKUS, INITIAL_WINDOWS } from "./mock-data";
import type { MatchFilters, SellWindow, SellWindowsPrototypeState } from "./types";

function nextWindowId(): string {
  return `win-${Date.now()}`;
}

function dayInput(iso: string): string {
  return iso.slice(0, 10);
}

export function useSellWindowsStore() {
  const [state, setState] = useState<SellWindowsPrototypeState>({
    now: new Date().toISOString(),
    skus: INITIAL_SKUS,
    windows: INITIAL_WINDOWS,
    lastAction: null,
  });
  const [filters, setFilters] = useState<MatchFilters>({
    categories: ["Christmas"],
    excludeSuppliers: ["sup-xd"],
    search: "",
  });
  const [windowName, setWindowName] = useState("Christmas 2026");
  const [opensAt, setOpensAt] = useState("2026-07-01");
  const [closesAt, setClosesAt] = useState("2027-01-15");
  const [checkedSkus, setCheckedSkus] = useState<Record<string, boolean>>({});
  const [editingWindowId, setEditingWindowId] = useState<string | null>(null);

  const now = useMemo(() => new Date(state.now), [state.now]);

  const windows = useMemo(
    () =>
      state.windows.map((window) => ({
        ...window,
        status: deriveWindowStatus(window, now),
      })),
    [now, state.windows],
  );

  const editingWindow = useMemo(
    () => windows.find((window) => window.id === editingWindowId) ?? null,
    [editingWindowId, windows],
  );

  const matchingSkus = useMemo(
    () => state.skus.filter((sku) => matchesFilters(sku, filters)),
    [filters, state.skus],
  );

  const applyEligibleSkus = useMemo(
    () => matchingSkus.filter(eligibleForBulkApply),
    [matchingSkus],
  );

  const selectedSkus = useMemo(() => {
    return applyEligibleSkus.filter((sku) => checkedSkus[sku.sku] !== false);
  }, [applyEligibleSkus, checkedSkus]);

  const setNow = useCallback((value: string) => {
    setState((current) => ({ ...current, now: value }));
  }, []);

  const toggleSku = useCallback((sku: string, checked: boolean) => {
    setCheckedSkus((current) => ({ ...current, [sku]: checked }));
  }, []);

  const selectAllMatching = useCallback(() => {
    setCheckedSkus((current) => {
      const next = { ...current };
      for (const sku of applyEligibleSkus) {
        next[sku.sku] = true;
      }
      return next;
    });
  }, [applyEligibleSkus]);

  const uncheckSupplier = useCallback(
    (supplierId: string) => {
      setCheckedSkus((current) => {
        const next = { ...current };
        for (const sku of applyEligibleSkus) {
          if (sku.supplierId === supplierId) {
            next[sku.sku] = false;
          }
        }
        return next;
      });
    },
    [applyEligibleSkus],
  );

  const prepareNewWindow = useCallback(() => {
    setEditingWindowId(null);
    setWindowName("Christmas 2026");
    setOpensAt("2026-07-01");
    setClosesAt("2027-01-15");
    setFilters({
      categories: ["Christmas"],
      excludeSuppliers: ["sup-xd"],
      search: "",
    });
    setCheckedSkus({});
  }, []);

  const loadWindow = useCallback(
    (windowId: string) => {
      const source = state.windows.find((window) => window.id === windowId);
      if (!source) {
        return false;
      }
      setEditingWindowId(windowId);
      setWindowName(source.name);
      setOpensAt(dayInput(source.opensAt));
      setClosesAt(dayInput(source.closesAt));
      setFilters({
        categories: [...source.categories],
        excludeSuppliers: [...source.excludeSuppliers],
        search: "",
      });
      const nextChecked: Record<string, boolean> = {};
      for (const sku of source.skuIds) {
        nextChecked[sku] = true;
      }
      setCheckedSkus(nextChecked);
      return true;
    },
    [state.windows],
  );

  const prepareClone = useCallback(
    (windowId: string) => {
      const source = state.windows.find((window) => window.id === windowId);
      if (!source) {
        return;
      }
      setEditingWindowId(null);
      setWindowName(`${source.name} (copy)`);
      setOpensAt(dayInput(source.opensAt));
      setClosesAt(dayInput(source.closesAt));
      setFilters({
        categories: [...source.categories],
        excludeSuppliers: [...source.excludeSuppliers],
        search: "",
      });
      setCheckedSkus({});
    },
    [state.windows],
  );

  const openInfinity = useCallback((): string | null => {
    const opens = parseDay(opensAt) ?? now;
    const closes = parseDay(closesAt);
    if (!closes) {
      setState((current) => ({
        ...current,
        lastAction: "Save blocked — close date is required.",
      }));
      return null;
    }
    if (closes <= opens) {
      setState((current) => ({
        ...current,
        lastAction: "Save blocked — close must be after open.",
      }));
      return null;
    }
    if (selectedSkus.length === 0) {
      setState((current) => ({
        ...current,
        lastAction: "Save blocked — no checked SKUs.",
      }));
      return null;
    }

    const windowId = nextWindowId();
    const skuIds = selectedSkus.map((sku) => sku.sku);
    const record: SellWindow = {
      id: windowId,
      name: windowName.trim() || "Untitled window",
      categories: [...filters.categories],
      excludeSuppliers: [...filters.excludeSuppliers],
      opensAt: opens.toISOString(),
      closesAt: closes.toISOString(),
      status: opens > now ? "scheduled" : "open",
      skuIds,
      appliedAt: now.toISOString(),
      appliedBy: "Staff (prototype)",
      manuallyClosedAt: null,
    };

    setState((current) => ({
      ...current,
      windows: [record, ...current.windows],
      skus: current.skus.map((sku) => {
        if (!skuIds.includes(sku.sku)) {
          return sku;
        }
        const windowIds = sku.windowIds.includes(windowId)
          ? sku.windowIds
          : [...sku.windowIds, windowId];
        return {
          ...sku,
          windowIds,
          stickyLocked: false,
        };
      }),
      lastAction: `Opened infinity for ${record.name} on ${skuIds.length} SKU(s).`,
    }));
    return windowId;
  }, [
    closesAt,
    filters.categories,
    filters.excludeSuppliers,
    now,
    opensAt,
    selectedSkus,
    windowName,
  ]);

  const closeWindow = useCallback(
    (windowId: string): boolean => {
      const window = state.windows.find((entry) => entry.id === windowId);
      if (!window) {
        return false;
      }
      const skuSet = new Set(window.skuIds);
      setState((current) => ({
        ...current,
        windows: current.windows.map((entry) =>
          entry.id === windowId
            ? {
                ...entry,
                status: "closed" as const,
                closesAt: now.toISOString(),
                manuallyClosedAt: now.toISOString(),
              }
            : entry,
        ),
        skus: current.skus.map((sku) =>
          skuSet.has(sku.sku) ? { ...sku, stickyLocked: true } : sku,
        ),
        lastAction: `Closed infinity for ${window.name}.`,
      }));
      return true;
    },
    [now, state.windows],
  );

  return {
    now,
    state,
    windows,
    editingWindow,
    editingWindowId,
    filters,
    setFilters,
    windowName,
    setWindowName,
    opensAt,
    setOpensAt,
    closesAt,
    setClosesAt,
    matchingSkus,
    applyEligibleSkus,
    selectedSkus,
    checkedSkus,
    toggleSku,
    selectAllMatching,
    uncheckSupplier,
    setNow,
    prepareNewWindow,
    loadWindow,
    prepareClone,
    openInfinity,
    closeWindow,
  };
}

export type SellWindowsStore = ReturnType<typeof useSellWindowsStore>;
