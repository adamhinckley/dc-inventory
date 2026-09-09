import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  acquireDraftMutationState,
  flushCartPendingChanges,
  readCartMutationSnapshot,
  setCartQtyDirty,
  trackCartReplaceEnd,
  trackCartReplaceStart,
} from "./cart-mutation-gate";

describe("cart-mutation-gate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shares debounced qty state across acquire calls for the same draft", async () => {
    const draftId = "draft-shared";
    const persist = vi.fn(async () => true);
    const drawer = acquireDraftMutationState(draftId);
    drawer.persistQtyHandler = persist;
    drawer.qtyTask.schedule([{ productId: "p1", qty: 2 }]);
    setCartQtyDirty(draftId, true);

    const cartPage = acquireDraftMutationState(draftId);
    expect(readCartMutationSnapshot(draftId).dirty).toBe(true);

    await flushCartPendingChanges(draftId);

    expect(persist).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledWith([{ productId: "p1", qty: 2 }]);
    expect(readCartMutationSnapshot(draftId).dirty).toBe(false);
    expect(cartPage.qtyTask).toBe(drawer.qtyTask);
  });

  it("tracks in-flight replace-lines across surfaces", () => {
    const draftId = "draft-pending";
    trackCartReplaceStart(draftId);
    expect(readCartMutationSnapshot(draftId).pending).toBe(true);
    trackCartReplaceEnd(draftId);
    expect(readCartMutationSnapshot(draftId).pending).toBe(false);
  });
});
