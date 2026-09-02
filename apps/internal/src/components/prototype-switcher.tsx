"use client";

import { Button } from "@dc-inventory/ui";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export type PrototypeVariant = { key: string; name: string };

export function PrototypeSwitcher({
  variants,
  param = "variant",
}: {
  variants: readonly PrototypeVariant[];
  param?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentKey = searchParams.get(param) ?? variants[0]?.key ?? "A";
  const index = Math.max(
    0,
    variants.findIndex((variant) => variant.key === currentKey),
  );
  const current = variants[index] ?? variants[0];

  function go(nextIndex: number) {
    const variant = variants[(nextIndex + variants.length) % variants.length];
    if (!variant) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set(param, variant.key);
    router.replace(`?${next.toString()}`);
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "ArrowLeft") go(index - 1);
      if (event.key === "ArrowRight") go(index + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-tight rounded-full border border-border bg-surface-overlay px-3 py-2 text-body-sm text-fg shadow-overlay">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Previous variant"
          onClick={() => go(index - 1)}
        >
          <ChevronLeft className="size-icon-lg" />
        </Button>
        <span className="min-w-48 text-center tabular-nums">
          {current?.key} — {current?.name}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label="Next variant"
          onClick={() => go(index + 1)}
        >
          <ChevronRight className="size-icon-lg" />
        </Button>
      </div>
    </div>
  );
}
