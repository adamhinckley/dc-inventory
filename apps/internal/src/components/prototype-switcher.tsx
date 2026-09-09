"use client";

// PROTOTYPE — throwaway. Floating bottom bar that cycles `?variant=` on the
// current route. Hidden in production builds. Delete with the prototype.

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";

export type PrototypeVariant = { key: string; name: string };

export function usePrototypeVariant(variants: readonly PrototypeVariant[]): string {
  const searchParams = useSearchParams();
  const raw = searchParams.get("variant");
  return variants.some((v) => v.key === raw) ? (raw as string) : variants[0]!.key;
}

export function PrototypeSwitcher({
  variants,
  current,
}: {
  variants: readonly PrototypeVariant[];
  current: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const go = useCallback(
    (delta: number) => {
      const idx = variants.findIndex((v) => v.key === current);
      const next = variants[(idx + delta + variants.length) % variants.length]!;
      const params = new URLSearchParams(searchParams.toString());
      params.set("variant", next.key);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [current, pathname, router, searchParams, variants],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (process.env.NODE_ENV === "production") return null;

  const name = variants.find((v) => v.key === current)?.name ?? "";
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-[#161616] px-2 py-1.5 font-mono text-xs text-white shadow-[0_8px_24px_rgba(0,0,0,.35)] ring-2 ring-[#f1c21b]">
        <button
          type="button"
          onClick={() => go(-1)}
          className="rounded-full px-2 py-1 hover:bg-white/15"
          aria-label="Previous variant"
        >
          ←
        </button>
        <span>
          PROTOTYPE · <b>{current}</b> — {name}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          className="rounded-full px-2 py-1 hover:bg-white/15"
          aria-label="Next variant"
        >
          →
        </button>
      </div>
    </div>
  );
}
