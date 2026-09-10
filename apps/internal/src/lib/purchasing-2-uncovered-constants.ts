import { UNCOVERED_NEEDS_MAPPING_FACTORY_ID } from "./uncovered-constants";

export { UNCOVERED_NEEDS_MAPPING_FACTORY_ID as PURCHASING2_UNCOVERED_NEEDS_MAPPING_FACTORY_ID };

export function isPurchasing2UncoveredNeedsMappingFactoryId(factoryId: string): boolean {
  return factoryId === UNCOVERED_NEEDS_MAPPING_FACTORY_ID;
}

export function purchasing2UncoveredFactoryDetailHref(factoryId: string): string {
  return `/procurement/pre-order/${factoryId}`;
}

export function purchasing2PurchaseOrderHref(purchaseOrderId: string): string {
  return `/procurement/purchase-orders/${purchaseOrderId}`;
}
