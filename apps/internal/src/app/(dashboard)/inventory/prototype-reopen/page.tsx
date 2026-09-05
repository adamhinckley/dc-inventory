"use client";

import { ReopenFilterWorkspace } from "../../../../components/prototype-reopen/reopen-filter-workspace";

/**
 * Staff batch reopen at catalog scale — filter bar + virtualized match set.
 * Throwaway — no production inventory HTTP. Branch proto/ada-285-reopen-scale.
 */
export default function PrototypeReopenPage() {
  return (
    <section className="flex min-h-0 flex-1 flex-col gap-region">
      <ReopenFilterWorkspace />
    </section>
  );
}
