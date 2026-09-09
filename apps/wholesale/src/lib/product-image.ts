/** Every product shows this until catalog images are wired (A10/A11). */
export const PRODUCT_PLACEHOLDER_SRC = "/brand/product-placeholder.svg";

export function productImageSrc(imageUrl: string | null | undefined): string {
  if (imageUrl === null || imageUrl === undefined || imageUrl.trim() === "") {
    return PRODUCT_PLACEHOLDER_SRC;
  }
  return imageUrl;
}

/** Placeholder is a drawn glyph; real photos should fill the frame. */
export function productImageIsPlaceholder(imageUrl: string | null | undefined): boolean {
  return productImageSrc(imageUrl) === PRODUCT_PLACEHOLDER_SRC;
}
