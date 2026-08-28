import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Combobox } from "../src/ui/Combobox";

describe("Combobox helper text", () => {
  it("renders helper text from the helperText prop", () => {
    const html = renderToStaticMarkup(
      createElement(Combobox, {
        options: [{ value: "hsv", label: "Huntsville DC" }],
        value: "hsv",
        onChange: () => undefined,
        helperText: "Ships to this warehouse.",
        "data-testid": "story-combobox",
      }),
    );

    expect(html).toContain("Ships to this warehouse.");
    expect(html).toContain("form-description");
    expect(html).toContain("gap-tight");
  });
});
