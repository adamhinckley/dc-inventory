import {
  CustomerId,
  OrderId,
  OrganizationId,
  ProductId,
  type StaffUserId,
  type WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import { newUuid, SalesOrderLineId } from "../domain/ids.js";
import type { ICatalogProductPort } from "../domain/ports/catalog-product.js";
import type {
  ICustomerLookupPort,
  ISalesOrderRepository,
} from "../domain/ports/sales-order-repository.js";
import type { SalesOrder, SalesOrderLine } from "../domain/sales-order.js";

export type CreateSalesOrderLineInput = {
  productId: string;
  qty: number;
};

type CreateSalesOrderRequestBase = {
  organizationId: OrganizationId;
  customerId: CustomerId;
  lines: readonly CreateSalesOrderLineInput[];
  shipLine1?: string;
  shipLine2?: string | null;
  shipCity?: string;
  shipRegion?: string;
  shipPostal?: string;
  shipCountry?: string;
};

export type CreateSalesOrderRequest = CreateSalesOrderRequestBase &
  (
    | { staffUserId: StaffUserId; wholesaleUserId?: never }
    | { wholesaleUserId: WholesaleUserId; staffUserId?: never }
  );

export type CreateSalesOrderResult =
  | { ok: true; salesOrder: SalesOrder }
  | {
      ok: false;
      reason:
        | "invalid"
        | "customer_not_found"
        | "empty_order"
        | "product_not_found"
        | "product_inactive"
        | "product_organization_mismatch";
    };

export class CreateSalesOrderUseCase {
  constructor(
    private readonly salesOrders: ISalesOrderRepository,
    private readonly customers: ICustomerLookupPort,
    private readonly catalogProducts: ICatalogProductPort,
    private readonly clock?: IClock,
  ) {}

  async execute(input: CreateSalesOrderRequest): Promise<CreateSalesOrderResult> {
    void input.staffUserId;
    void input.wholesaleUserId;
    if (input.lines.length === 0) {
      return { ok: false, reason: "empty_order" };
    }

    const customer = await this.customers.findById(input.organizationId, input.customerId);
    if (customer === null) {
      return { ok: false, reason: "customer_not_found" };
    }

    const requestedQuantities = new Map<ProductId, number>();
    for (const line of input.lines) {
      if (!Number.isInteger(line.qty) || line.qty <= 0) {
        return { ok: false, reason: "invalid" };
      }
      try {
        const productId = ProductId.parse(line.productId);
        requestedQuantities.set(
          productId,
          (requestedQuantities.get(productId) ?? 0) + line.qty,
        );
      } catch {
        return { ok: false, reason: "invalid" };
      }
    }

    const lines: SalesOrderLine[] = [];
    for (const [productId, qty] of requestedQuantities) {
      const product = await this.catalogProducts.findById(input.organizationId, productId);
      if (product === null) {
        return { ok: false, reason: "product_not_found" };
      }
      if (product.organizationId !== input.organizationId) {
        return { ok: false, reason: "product_organization_mismatch" };
      }
      if (!product.active) {
        return { ok: false, reason: "product_inactive" };
      }
      lines.push({
        id: SalesOrderLineId.parse(newUuid()),
        sku: product.sku,
        name: product.name,
        qty,
        unitPrice: product.unitPrice,
        taxCategoryCode: product.taxCategoryCode,
      });
    }

    const createdAt = this.clock?.now() ?? new Date();
    const salesOrder = await this.salesOrders.insertWithNextDocumentNumber({
      id: OrderId.parse(newUuid()),
      organizationId: input.organizationId,
      customerId: input.customerId,
      status: "draft",
      createdAt,
      lines,
      shipLine1: input.shipLine1,
      shipLine2: input.shipLine2,
      shipCity: input.shipCity,
      shipRegion: input.shipRegion,
      shipPostal: input.shipPostal,
      shipCountry: input.shipCountry,
    });
    return { ok: true, salesOrder };
  }
}
