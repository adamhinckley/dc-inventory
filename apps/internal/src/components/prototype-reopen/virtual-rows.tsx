"use client";

/** PROTOTYPE — window only the visible rows of a long list. */
import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef, type ReactNode } from "react";

export function VirtualRows<T>({
  items,
  estimateSize,
  overscan = 12,
  className,
  children,
}: {
  items: readonly T[];
  estimateSize: number;
  overscan?: number;
  className?: string;
  children: (item: T, index: number) => ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const measuredRef = useRef(false);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  return (
    <div
      ref={(node) => {
        scrollRef.current = node;
        if (node && !measuredRef.current) {
          measuredRef.current = true;
          virtualizer.measure();
        }
      }}
      tabIndex={-1}
      className={className}
    >
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const item = items[virtualItem.index];
          if (item === undefined) {
            return null;
          }
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full"
              style={{
                height: virtualItem.size,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {children(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
