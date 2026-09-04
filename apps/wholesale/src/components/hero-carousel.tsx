"use client";

import { useState } from "react";
import { carouselSlides } from "../lib/carousel-slides";

export function HeroCarousel() {
  const [index, setIndex] = useState(0);
  const slide = carouselSlides[index] ?? carouselSlides[0];

  if (!slide) {
    return null;
  }

  function go(next: number) {
    setIndex((next + carouselSlides.length) % carouselSlides.length);
  }

  return (
    <section aria-roledescription="carousel" aria-label="Featured photography">
      <div className="relative overflow-hidden bg-canvas-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={slide.src}
          alt={slide.alt}
          className="aspect-[1730/900] w-full object-cover"
        />
        <button
          type="button"
          aria-label="Previous"
          className="absolute top-1/2 left-4 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-overlay/90 text-ink shadow-sm"
          onClick={() => go(index - 1)}
        >
          <Chevron direction="left" />
        </button>
        <button
          type="button"
          aria-label="Next"
          className="absolute top-1/2 right-4 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-overlay/90 text-ink shadow-sm"
          onClick={() => go(index + 1)}
        >
          <Chevron direction="right" />
        </button>
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          {carouselSlides.map((item, slideIndex) => (
            <button
              key={item.src}
              type="button"
              aria-label={`Show slide ${slideIndex + 1}`}
              aria-current={slideIndex === index ? true : undefined}
              className={`h-2.5 w-2.5 rounded-full border border-card ${
                slideIndex === index ? "bg-card" : "bg-transparent"
              }`}
              onClick={() => go(slideIndex)}
            />
          ))}
        </div>
        <p className="sr-only">
          Slide {index + 1} of {carouselSlides.length}
        </p>
      </div>
    </section>
  );
}

function Chevron({ direction }: { direction: "left" | "right" }) {
  return (
    <span
      aria-hidden="true"
      className={
        direction === "left"
          ? "mt-0.5 ml-0.5 inline-block size-2.5 rotate-45 border-b-2 border-l-2 border-current"
          : "mt-0.5 mr-0.5 inline-block size-2.5 rotate-45 border-t-2 border-r-2 border-current"
      }
    />
  );
}
