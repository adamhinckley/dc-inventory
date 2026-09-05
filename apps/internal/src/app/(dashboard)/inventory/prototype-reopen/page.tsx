"use client";

import { TooltipHelp } from "@dc-inventory/ui";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  parseVariant,
  PrototypeSwitcher,
} from "../../../../components/prototype-reopen/prototype-switcher";
import { VariantA } from "../../../../components/prototype-reopen/variant-a-filter-select-all";
import { VariantB } from "../../../../components/prototype-reopen/variant-b-saved-lists";
import { VariantC } from "../../../../components/prototype-reopen/variant-c-import-confirm";

/**
 * Three variants of staff batch reopen at catalog scale, switchable via ?variant=.
 * Throwaway — no production inventory HTTP. Branch proto/ada-285-reopen-scale.
 */
function PrototypeReopenBody() {
  const variant = parseVariant(useSearchParams().get("variant"));

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-region">
      <header className="flex shrink-0 items-center gap-tight">
        <h1 className="page-title">Reopen For Pre-Sell (Prototype)</h1>
        <TooltipHelp
          title="Prototype"
          description="Throwaway UI for ADA-285. Flip A/B/C with the bar or arrow keys. Nothing writes sell state."
        />
      </header>
      {variant === "A" ? <VariantA /> : null}
      {variant === "B" ? <VariantB /> : null}
      {variant === "C" ? <VariantC /> : null}
      <PrototypeSwitcher current={variant} />
    </section>
  );
}

export default function PrototypeReopenPage() {
  return (
    <Suspense fallback={<p className="text-body-sm">Loading prototype…</p>}>
      <PrototypeReopenBody />
    </Suspense>
  );
}
