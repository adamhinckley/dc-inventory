"use client";

import { Button } from "@dc-inventory/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const KEYS = ["A", "B", "C"] as const;

export const VARIANT_NAMES = {
  A: "Filter + Select All Matching",
  B: "Saved Lists + Review Checklist",
  C: "Paste SKUs + Confirm Skip",
} as const;

export type PrototypeVariant = (typeof KEYS)[number];

export function parseVariant(raw: string | null): PrototypeVariant {
  if (raw === "B" || raw === "C") {
    return raw;
  }
  return "A";
}

export function PrototypeSwitcher({ current }: { current: PrototypeVariant }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function go(next: PrototypeVariant) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("variant", next);
    router.replace(`?${params.toString()}`);
  }

  function step(delta: number) {
    const i = KEYS.indexOf(current);
    go(KEYS[(i + delta + KEYS.length) % KEYS.length]!);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.closest("input, textarea, [contenteditable=true]") !== null)
      ) {
        return;
      }
      if (event.key === "ArrowLeft") {
        step(-1);
      }
      if (event.key === "ArrowRight") {
        step(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, searchParams]);

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-tight rounded-full border border-border bg-surface-overlay px-3 py-2 shadow-overlay">
        <Button type="button" size="sm" variant="ghost" onClick={() => step(-1)}>
          <ChevronLeft />
          Prev
        </Button>
        <span className="min-w-64 px-2 text-center text-body-sm font-semibold text-fg">
          {current} — {VARIANT_NAMES[current]}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={() => step(1)}>
          Next
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
