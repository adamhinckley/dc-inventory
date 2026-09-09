/** Coalesce rapid UI events into one async persist. Latest value wins. */
export function createDebouncedTask<T>(
  run: (value: T) => Promise<void>,
  delayMs: number,
): {
  schedule: (value: T) => void;
  flush: () => Promise<void>;
  cancel: () => void;
  hasPending: () => boolean;
} {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queued: { value: T } | undefined;
  let inFlight: Promise<void> | undefined;

  function clearTimer(): void {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
  }

  async function drain(): Promise<void> {
    if (inFlight !== undefined) {
      await inFlight;
    }
    while (queued !== undefined) {
      const { value } = queued;
      queued = undefined;
      inFlight = run(value).finally(() => {
        inFlight = undefined;
      });
      await inFlight;
    }
  }

  return {
    schedule(value) {
      queued = { value };
      clearTimer();
      timer = setTimeout(() => {
        timer = undefined;
        void drain();
      }, delayMs);
    },
    async flush() {
      clearTimer();
      if (queued === undefined && inFlight === undefined) {
        return;
      }
      await drain();
    },
    cancel() {
      clearTimer();
      queued = undefined;
    },
    hasPending() {
      return timer !== undefined || queued !== undefined || inFlight !== undefined;
    },
  };
}
