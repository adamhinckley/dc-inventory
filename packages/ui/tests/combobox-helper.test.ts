import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Combobox, filterComboboxOptionsForQuery } from "../src/ui/Combobox";

describe("filterComboboxOptionsForQuery", () => {
  const options = [
    { value: "hsv", label: "Huntsville DC" },
    { value: "atl", label: "Atlanta DC" },
  ];
  const contains = (item: { label: string }, query: string) =>
    item.label.toLowerCase().includes(query.toLowerCase());

  it("returns zero matches for a query with no hits", () => {
    expect(filterComboboxOptionsForQuery(options, "zzz", contains)).toEqual([]);
  });

  it("returns matching options for a partial query", () => {
    expect(filterComboboxOptionsForQuery(options, "atl", contains)).toEqual([
      { value: "atl", label: "Atlanta DC" },
    ]);
  });
});

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
