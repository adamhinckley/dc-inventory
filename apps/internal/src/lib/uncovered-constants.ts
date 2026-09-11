/** Matches `PRE_ORDER_NEEDS_MAPPING_FACTORY_ROW_ID` on the inventory API. */
export const PRE_ORDER_NEEDS_MAPPING_FACTORY_ID = "needs-mapping";

export function isPreOrderNeedsMappingFactoryId(factoryId: string): boolean {
  return factoryId === PRE_ORDER_NEEDS_MAPPING_FACTORY_ID;
}

export function preOrderFactoryDetailHref(factoryId: string): string {
  return `/procurement/pre-order/${factoryId}`;
}
