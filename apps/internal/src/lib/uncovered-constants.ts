/** Matches `UNCOVERED_NEEDS_MAPPING_FACTORY_ROW_ID` on the inventory API. */
export const UNCOVERED_NEEDS_MAPPING_FACTORY_ID = "needs-mapping";

export function isUncoveredNeedsMappingFactoryId(factoryId: string): boolean {
  return factoryId === UNCOVERED_NEEDS_MAPPING_FACTORY_ID;
}

export function uncoveredFactoryDetailHref(factoryId: string): string {
  return `/procurement/pre-order/${factoryId}`;
}
