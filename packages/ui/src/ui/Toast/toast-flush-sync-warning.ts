/** React 19 warning from Base UI Toast.Root measuring with flushSync in a layout effect. */
export const REACT_FLUSH_SYNC_LIFECYCLE_WARNING =
  "flushSync was called from inside a lifecycle method";

export function isReactFlushSyncLifecycleWarning(...args: unknown[]): boolean {
  return args.some((arg) => {
    if (typeof arg === "string") {
      return arg.includes(REACT_FLUSH_SYNC_LIFECYCLE_WARNING);
    }
    if (arg instanceof Error) {
      return arg.message.includes(REACT_FLUSH_SYNC_LIFECYCLE_WARNING);
    }
    return false;
  });
}

export function silenceReactFlushSyncLifecycleWarning(): () => void {
  const original = console.error;
  console.error = (...args: Parameters<typeof console.error>) => {
    if (isReactFlushSyncLifecycleWarning(...args)) {
      return;
    }
    original.apply(console, args);
  };
  return () => {
    console.error = original;
  };
}
