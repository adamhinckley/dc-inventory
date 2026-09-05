import { Suspense, type ReactNode } from "react";
import { InventoryHeading } from "../../../components/inventory-heading";
import { InventoryWorkspace } from "../../../components/inventory-workspace";

export default function InventoryLayout({ children }: { children: ReactNode }) {
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-region">
      <InventoryHeading />
      <Suspense>
        <InventoryWorkspace>{children}</InventoryWorkspace>
      </Suspense>
    </section>
  );
}
