"use client";

import { PrototypeSwitcher } from "../../../../components/prototype-switcher";
import {
  VariantA,
  VariantB,
  VariantC,
} from "../../../../components/prototype-receiving-variants";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const VARIANTS = [
  { key: "A", name: "Table then document" },
  { key: "B", name: "Dock split" },
  { key: "C", name: "One-PO queue" },
] as const;

function ReceivingPrototypeInner() {
  const variant = useSearchParams().get("variant") ?? "A";

  return (
    <>
      <p className="mb-region text-caption text-fg-muted">
        PROTOTYPE — throwaway. Not the Receiving implementation.
      </p>
      {variant === "B" ? <VariantB /> : null}
      {variant === "C" ? <VariantC /> : null}
      {variant !== "B" && variant !== "C" ? <VariantA /> : null}
      <PrototypeSwitcher variants={VARIANTS} />
    </>
  );
}

export default function ReceivingPrototypePage() {
  return (
    <Suspense>
      <ReceivingPrototypeInner />
    </Suspense>
  );
}
