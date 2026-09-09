import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDebouncedTask } from "./debounce-task";

describe("createDebouncedTask", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not run until the quiet period elapses", async () => {
    const run = vi.fn(async () => undefined);
    const task = createDebouncedTask(run, 400);

    task.schedule(1);
    await vi.advanceTimersByTimeAsync(399);
    expect(run).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(1);
  });

  it("keeps only the latest scheduled value", async () => {
    const run = vi.fn(async () => undefined);
    const task = createDebouncedTask(run, 400);

    task.schedule(1);
    await vi.advanceTimersByTimeAsync(200);
    task.schedule(2);
    await vi.advanceTimersByTimeAsync(200);
    task.schedule(5);
    await vi.advanceTimersByTimeAsync(400);

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(5);
  });

  it("flushes the latest value immediately", async () => {
    const run = vi.fn(async () => undefined);
    const task = createDebouncedTask(run, 400);

    task.schedule(3);
    await task.flush();

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledWith(3);
  });

  it("runs again with the latest value after an in-flight persist", async () => {
    let finishFirst: (() => void) | undefined;
    const run = vi
      .fn<(value: number) => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishFirst = () => resolve();
          }),
      )
      .mockResolvedValue(undefined);
    const task = createDebouncedTask(run, 400);

    task.schedule(1);
    await vi.advanceTimersByTimeAsync(400);
    expect(run).toHaveBeenCalledTimes(1);

    task.schedule(4);
    finishFirst?.();
    await vi.advanceTimersByTimeAsync(400);

    expect(run).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenLastCalledWith(4);
  });
});
