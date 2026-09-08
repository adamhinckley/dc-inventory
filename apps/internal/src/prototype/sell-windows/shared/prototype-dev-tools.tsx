"use client";

import { DateInput, Label } from "@dc-inventory/ui";
import { useSellWindowsPrototype } from "../sell-windows-prototype-context";

/** Collapsed demo controls — not part of the product UI. */
export function PrototypeDevTools() {
  const store = useSellWindowsPrototype();
  const day = store.state.now.slice(0, 10);

  return (
    <details className="rounded-section border border-dashed border-border px-4 py-3 text-body-sm">
      <summary className="cursor-pointer text-fg-secondary">
        Prototype demo tools (auto-close preview)
      </summary>
      <p className="mt-field text-fg-secondary">
        Production uses the real clock on every order. This control only exists in the
        prototype so you can jump past a window close date and see SKUs lock.
      </p>
      <div className="mt-field flex flex-wrap items-end gap-field-group">
        <div>
          <Label htmlFor="prototype-demo-now">Pretend today is</Label>
          <DateInput
            id="prototype-demo-now"
            density="compact"
            className="mt-field w-52"
            value={day}
            onChange={(value) => {
              const parsed =
                value.trim() === "" ? new Date() : new Date(`${value}T12:00:00`);
              store.setNow(parsed.toISOString());
            }}
            yearNavigation
          />
        </div>
      </div>
      {store.state.lastAction ? (
        <p className="mt-field text-fg-secondary">Last action: {store.state.lastAction}</p>
      ) : null}
    </details>
  );
}
