import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Chip } from "../src/ui/Chip";

describe("Chip", () => {
  it("renders a leading status dot inside the pill", () => {
    const html = renderToStaticMarkup(
      createElement(Chip, { icon: createElement(Chip.Dot), children: "On order" }),
    );

    expect(html).toContain("On order");
    expect(html).toContain("glassmorphic-chip");
    expect(html).toContain("rounded-full");
    expect(html).toContain("size-1.5");
  });

  it("pulses the dot and marks the chip busy while an action is in flight", () => {
    const html = renderToStaticMarkup(createElement(Chip, { busy: true, children: "Saving" }));

    expect(html).toContain("Saving");
    expect(html).toContain("aria-busy");
    expect(html).toContain("animate-ping");
  });
});
