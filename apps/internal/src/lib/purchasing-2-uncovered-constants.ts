import { PRE_ORDER_NEEDS_MAPPING_FACTORY_ID } from "./uncovered-constants";

export { PRE_ORDER_NEEDS_MAPPING_FACTORY_ID as PURCHASING2_PRE_ORDER_NEEDS_MAPPING_FACTORY_ID };

export function isPurchasing2PreOrderNeedsMappingFactoryId(factoryId: string): boolean {
  return factoryId === PRE_ORDER_NEEDS_MAPPING_FACTORY_ID;
}

export function purchasing2PreOrderFactoryDetailHref(factoryId: string): string {
  return `/procurement/pre-order/${factoryId}`;
}

export function purchasing2PurchaseOrderHref(purchaseOrderId: string): string {
  return `/procurement/purchase-orders/${purchaseOrderId}`;
}
