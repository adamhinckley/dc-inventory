const QTY_KEYS = ["qty", "onHand", "onOrder", "allocated", "available"] as const;

export function hasQtyWriteFields(input: object): boolean {
  return QTY_KEYS.some((key) => Object.hasOwn(input, key));
}

export function hasSkuField(input: object): boolean {
  return Object.hasOwn(input, "sku");
}
