import {
  CustomerId,
  Money,
  OrderId,
  Sku,
  type StaffUserId,
} from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import { newUuid, SalesOrderLineId } from "../domain/ids.js";
import type {
  ICustomerLookupPort,
  ISalesOrderRepository,
} from "../domain/ports/sales-order-repository.js";
import type { SalesOrder, SalesOrderLine } from "../domain/sales-order.js";

export type CreateSalesOrderLineInput = {
  sku: string;
  name: string;
  qty: number;
  unitPriceCents: number;
  currency: string;
  taxCategoryCode?: string;
};

export type CreateSalesOrderRequest = {
  staffUserId: StaffUserId;
  customerId: CustomerId;
  lines: readonly CreateSalesOrderLineInput[];
  shipLine1?: string;
  shipLine2?: string | null;
  shipCity?: string;
  shipRegion?: string;
  shipPostal?: string;
  shipCountry?: string;
};

export type CreateSalesOrderResult =
  | { ok: true; salesOrder: SalesOrder }
  | { ok: false; reason: "invalid" | "customer_not_found" | "empty_order" };

type MergedLine = {
  sku: Sku;
  name: string;
  qty: number;
  unitPrice: Money;
  taxCategoryCode?: string;
};

export class CreateSalesOrderUseCase {
  constructor(
    private readonly salesOrders: ISalesOrderRepository,
    private readonly customers: ICustomerLookupPort,
    private readonly clock?: IClock,
  ) {}

  async execute(input: CreateSalesOrderRequest): Promise<CreateSalesOrderResult> {
    void input.staffUserId;
    if (input.lines.length === 0) {
      return { ok: false, reason: "empty_order" };
    }

    const customer = await this.customers.findById(input.customerId);
    if (customer === null) {
      return { ok: false, reason: "customer_not_found" };
    }

    const merged = new Map<string, MergedLine>();
    for (const line of input.lines) {
      const name = line.name.trim();
      if (name.length === 0 || !Number.isInteger(line.qty) || line.qty <= 0) {
        return { ok: false, reason: "invalid" };
      }
      if (!Number.isInteger(line.unitPriceCents) || line.unitPriceCents < 0) {
        return { ok: false, reason: "invalid" };
      }
      try {
        const sku = Sku.parse(line.sku);
        const unitPrice = Money.fromMinorUnits(line.unitPriceCents, line.currency);
        const existing = merged.get(sku.value);
        if (existing === undefined) {
          merged.set(sku.value, {
            sku,
            name,
            qty: line.qty,
            unitPrice,
            taxCategoryCode: line.taxCategoryCode,
          });
          continue;
        }
        if (
          existing.name !== name ||
          !existing.unitPrice.equals(unitPrice) ||
          existing.taxCategoryCode !== line.taxCategoryCode
        ) {
          return { ok: false, reason: "invalid" };
        }
        existing.qty += line.qty;
      } catch {
        return { ok: false, reason: "invalid" };
      }
    }

    const lines: SalesOrderLine[] = [...merged.values()].map((line) => ({
      id: SalesOrderLineId.parse(newUuid()),
      sku: line.sku,
      name: line.name,
      qty: line.qty,
      unitPrice: line.unitPrice,
      taxCategoryCode: line.taxCategoryCode,
    }));

    void this.clock;
    const documentNumber = await this.salesOrders.nextDocumentNumber();
    const salesOrder: SalesOrder = {
      id: OrderId.parse(newUuid()),
      customerId: input.customerId,
      documentNumber,
      status: "draft",
      createdAt: new Date(),
      lines,
      shipLine1: input.shipLine1,
      shipLine2: input.shipLine2,
      shipCity: input.shipCity,
      shipRegion: input.shipRegion,
      shipPostal: input.shipPostal,
      shipCountry: input.shipCountry,
    };
    await this.salesOrders.save(salesOrder);
    return { ok: true, salesOrder };
  }
}
