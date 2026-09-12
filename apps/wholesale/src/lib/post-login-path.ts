type WholesaleSessionLike = {
  mode: "buyer" | "staff_acting";
  customerId: string | null;
};

export type PostLoginPathOptions = {
  category?: string | null;
};

export function postLoginPath(
  session: WholesaleSessionLike,
  options?: PostLoginPathOptions,
): "/products" | `/products?category=${string}` | "/select-customer" {
  if (session.mode === "staff_acting" && session.customerId === null) {
    return "/select-customer";
  }
  const category = options?.category;
  if (category !== null && category !== undefined && category.length > 0) {
    return `/products?category=${encodeURIComponent(category)}`;
  }
  return "/products";
}
