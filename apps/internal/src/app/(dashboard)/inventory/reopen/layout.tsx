import { Suspense, type ReactNode } from "react";
import { SellWindowsPrototypeGate } from "../../../../prototype/sell-windows/sell-windows-prototype-gate";

export default function InventoryReopenLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense>
      <SellWindowsPrototypeGate>{children}</SellWindowsPrototypeGate>
    </Suspense>
  );
}
