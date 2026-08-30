import { describe, expect, it, vi } from "vitest";
import {
  isReactFlushSyncLifecycleWarning,
  silenceReactFlushSyncLifecycleWarning,
} from "../src/ui/Toast/toast-flush-sync-warning";

describe("Base UI toast flushSync warning", () => {
  it("matches the React lifecycle warning and ignores other console errors", () => {
    expect(
      isReactFlushSyncLifecycleWarning(
        "flushSync was called from inside a lifecycle method. React cannot flush when React is already rendering.",
      ),
    ).toBe(true);
    expect(
      isReactFlushSyncLifecycleWarning(
        new Error("flushSync was called from inside a lifecycle method"),
      ),
    ).toBe(true);
    expect(isReactFlushSyncLifecycleWarning("Failed to save case quantity")).toBe(
      false,
    );
  });

  it("swallows only that warning on console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const restore = silenceReactFlushSyncLifecycleWarning();
    console.error("flushSync was called from inside a lifecycle method");
    console.error("Autosave failed.");
    restore();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("Autosave failed.");
    spy.mockRestore();
  });
});
