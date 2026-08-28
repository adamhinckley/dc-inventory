import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { TextInput } from "../src/ui/TextInput";

describe("TextInput field copy", () => {
  it("renders a label and helper text from props", () => {
    const html = renderToStaticMarkup(
      createElement(TextInput, {
        label: "Product",
        helperText: "Search by SKU or display name.",
        placeholder: "SKU or name",
        "data-testid": "story-text-input",
      }),
    );

    expect(html).toContain("Product");
    expect(html).toContain("Search by SKU or display name.");
    expect(html).toContain("form-description");
    expect(html).toContain("gap-tight");
    expect(html).not.toContain("role=\"alert\"");
  });

  it("renders an error message, marks the input invalid, and hides helper text", () => {
    const html = renderToStaticMarkup(
      createElement(TextInput, {
        id: "product",
        label: "Product",
        helperText: "Search by SKU or display name.",
        error: "Enter a SKU or name.",
        placeholder: "SKU or name",
        "data-testid": "story-text-input",
      }),
    );

    expect(html).toContain("Enter a SKU or name.");
    expect(html).toContain("role=\"alert\"");
    expect(html).toContain("aria-invalid");
    expect(html).toContain("data-invalid");
    expect(html).not.toContain("Search by SKU or display name.");
  });
});
