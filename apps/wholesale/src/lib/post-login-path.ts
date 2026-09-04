type WholesaleSessionLike = {
  mode: "buyer" | "staff_acting";
  customerId: string | null;
};

export function postLoginPath(session: WholesaleSessionLike): "/products" | "/select-customer" {
  if (session.mode === "staff_acting" && session.customerId === null) {
    return "/select-customer";
  }
  return "/products";
}
