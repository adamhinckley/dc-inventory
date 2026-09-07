"use client";

import { useEffect, useRef, useState } from "react";
import { carouselSlides } from "../lib/carousel-slides";

const AUTO_ADVANCE_MS = 5000;
const FADE_MS = 700;

export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const [outgoingIndex, setOutgoingIndex] = useState<number | null>(null);
  const [incomingReady, setIncomingReady] = useState(true);
  const previousIndexRef = useRef(index);

  useEffect(() => {
    if (previousIndexRef.current === index) {
      return;
    }

    setOutgoingIndex(previousIndexRef.current);
    previousIndexRef.current = index;
    setIncomingReady(false);
    const raf = requestAnimationFrame(() => setIncomingReady(true));
    return () => cancelAnimationFrame(raf);
  }, [index]);

  useEffect(() => {
    if (outgoingIndex === null) {
      return;
    }

    const timer = window.setTimeout(() => setOutgoingIndex(null), FADE_MS);
    return () => window.clearTimeout(timer);
  }, [outgoingIndex, index]);

  useEffect(() => {
    if (carouselSlides.length <= 1) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % carouselSlides.length);
    }, AUTO_ADVANCE_MS);

    return () => window.clearInterval(timer);
  }, [index]);

  useEffect(() => {
    if (carouselSlides.length <= 1) {
      return;
    }

    const nextIndex = (index + 1) % carouselSlides.length;
    const preload = new Image();
    preload.src = carouselSlides[nextIndex]?.src ?? "";
  }, [index]);

  const slide = carouselSlides[index] ?? carouselSlides[0];

  if (!slide) {
    return null;
  }

  function go(next: number) {
    setIndex((next + carouselSlides.length) % carouselSlides.length);
  }

  const visibleIndices =
    outgoingIndex === null ? [index] : [index, outgoingIndex];

  return (
    <section aria-roledescription="carousel" aria-label="Featured photography">
      <div className="mx-auto w-full max-w-[var(--max-width-content)]">
        <div className="relative aspect-[1730/900] w-full overflow-hidden bg-canvas-muted">
          {visibleIndices.map((slideIndex) => {
            const item = carouselSlides[slideIndex];
            if (!item) {
              return null;
            }

            const isActive = slideIndex === index;
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={item.src}
                src={item.src}
                alt={isActive ? item.alt : ""}
                aria-hidden={!isActive}
                fetchPriority={slideIndex === 0 ? "high" : undefined}
                loading={slideIndex === 0 ? "eager" : "lazy"}
                className={`absolute inset-0 size-full object-cover transition-opacity duration-700 ease-in-out ${
                  isActive
                    ? incomingReady
                      ? "opacity-100"
                      : "opacity-0"
                    : "opacity-0"
                }`}
              />
            );
          })}
          <button
            type="button"
            aria-label="Previous"
            className="absolute top-1/2 left-4 -translate-y-1/2 cursor-pointer p-2"
            onClick={() => go(index - 1)}
          >
            <Chevron direction="left" />
          </button>
          <button
            type="button"
            aria-label="Next"
            className="absolute top-1/2 right-4 -translate-y-1/2 cursor-pointer p-2"
            onClick={() => go(index + 1)}
          >
            <Chevron direction="right" />
          </button>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
            {carouselSlides.map((item, slideIndex) => {
              const isActive = slideIndex === index;
              return (
                <button
                  key={item.src}
                  type="button"
                  aria-label={`Show slide ${slideIndex + 1}`}
                  aria-current={isActive ? true : undefined}
                  className={`h-2.5 w-2.5 cursor-pointer rounded-full border-2 border-white drop-shadow-[0_0_1px_rgba(0,0,0,0.9)] drop-shadow-[0_1px_3px_rgba(0,0,0,0.55)] ${
                    isActive ? "bg-white" : "bg-black/30"
                  }`}
                  onClick={() => go(slideIndex)}
                />
              );
            })}
          </div>
          <p className="sr-only">
            Slide {index + 1} of {carouselSlides.length}
          </p>
        </div>
      </div>
    </section>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  const base =
    "inline-block size-5 rotate-45 border-current text-white drop-shadow-[0_0_1px_rgba(0,0,0,0.9)] drop-shadow-[0_1px_4px_rgba(0,0,0,0.55)]";

  return (
    <span
      aria-hidden="true"
      className={
        direction === "left"
          ? `${base} ml-1 border-b-[3px] border-l-[3px]`
          : `${base} mr-1 border-t-[3px] border-r-[3px]`
      }
    />
  );
}
