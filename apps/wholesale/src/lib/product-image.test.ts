import { describe, expect, it } from "vitest";
import {
  PRODUCT_PLACEHOLDER_SRC,
  productImageIsPlaceholder,
  productImageSrc,
} from "./product-image.js";

describe("productImageSrc", () => {
  it("falls back to the shared placeholder when the API has no image", () => {
    expect(productImageSrc(null)).toBe(PRODUCT_PLACEHOLDER_SRC);
    expect(productImageSrc("   ")).toBe(PRODUCT_PLACEHOLDER_SRC);
  });

  it("keeps a real catalog image URL untouched", () => {
    expect(productImageSrc("https://cdn.example.com/DC16171GN.jpg")).toBe(
      "https://cdn.example.com/DC16171GN.jpg",
    );
  });

  it("tells the card whether to contain the glyph or cover with a photo", () => {
    expect(productImageIsPlaceholder(null)).toBe(true);
    expect(productImageIsPlaceholder("https://cdn.example.com/x.jpg")).toBe(false);
  });
});
