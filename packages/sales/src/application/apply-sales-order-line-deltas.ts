import {
  CustomerId,
  OrderId,
  OrganizationId,
  ProductId,
  Sku,
  type StaffUserId,
  type WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import type { ICatalogProductPort } from "../domain/ports/catalog-product.js";
import type {
  ICustomerLookupPort,
  ISalesOrderRepository,
} from "../domain/ports/sales-order-repository.js";
import type { SalesOrder, SalesOrderLine } from "../domain/sales-order.js";
import { SalesOrderLineId, newUuid } from "../domain/ids.js";
import { createDraftAccountStatusGate } from "./account-status-gate.js";
import {
  buildSalesOrderLines,
  type SalesOrderLineInput,
} from "./build-sales-order-lines.js";
import type { ConfirmSalesOrderShortage } from "./confirm-sales-order.js";

export type SalesOrderLineDeltaAdd = {
  /** New line, or increment existing draft qty by this amount when the SKU is already present. */
  productId: string;
  qty: number;
};

export type SalesOrderLineDeltaUpdate = {
  lineId?: string;
  sku?: string;
  qty: number;
};

export type ApplySalesOrderLineDeltasRequest = {
  organizationId: OrganizationId;
  customerId?: CustomerId;
  salesOrderId: OrderId;
  add?: readonly SalesOrderLineDeltaAdd[];
  update?: readonly SalesOrderLineDeltaUpdate[];
  remove?: readonly string[];
} & (
  | { staffUserId: StaffUserId; wholesaleUserId?: never; placedByStaffUserId?: never }
  | {
      wholesaleUserId: WholesaleUserId;
      customerId: CustomerId;
      staffUserId?: never;
      placedByStaffUserId?: never;
    }
  | {
      placedByStaffUserId: StaffUserId;
      customerId: CustomerId;
      staffUserId?: never;
      wholesaleUserId?: never;
    }
);

export type ApplySalesOrderLineDeltasResult =
  | { ok: true; salesOrder: SalesOrder }
  | {
      ok: false;
      reason:
        | "not_found"
        | "illegal_transition"
        | "invalid"
        | "customer_not_found"
        | "product_not_found"
        | "product_inactive"
        | "product_organization_mismatch"
        | "customer_on_hold"
        | "customer_inactive"
        | "insufficient_atp";
      shortage?: ConfirmSalesOrderShortage;
    };

type WorkingLine = {
  lineId: SalesOrderLineId;
  sku: Sku;
  qty: number;
  productId?: ProductId;
};

function hasDeltaWork(input: ApplySalesOrderLineDeltasRequest): boolean {
  return (
    (input.add?.length ?? 0) > 0 ||
    (input.update?.length ?? 0) > 0 ||
    (input.remove?.length ?? 0) > 0
  );
}

function findWorkingLineIndex(working: WorkingLine[], identifier: string): number {
  try {
    const lineId = SalesOrderLineId.parse(identifier);
    const byId = working.findIndex((line) => line.lineId === lineId);
    if (byId >= 0) {
      return byId;
    }
  } catch {
    // not a line id — fall through to sku
  }
  try {
    const sku = Sku.parse(identifier);
    return working.findIndex((line) => line.sku.value === sku.value);
  } catch {
    return -1;
  }
}

function findUpdateTarget(
  working: WorkingLine[],
  update: SalesOrderLineDeltaUpdate,
): number {
  if (update.lineId !== undefined) {
    return findWorkingLineIndex(working, update.lineId);
  }
  if (update.sku !== undefined) {
    return findWorkingLineIndex(working, update.sku);
  }
  return -1;
}

function workingFromExisting(lines: readonly SalesOrderLine[]): WorkingLine[] {
  return lines.map((line) => ({
    lineId: line.id,
    sku: line.sku,
    qty: line.qty,
  }));
}

export class ApplySalesOrderLineDeltasUseCase {
  constructor(
    private readonly salesOrders: ISalesOrderRepository,
    private readonly customers: ICustomerLookupPort,
    private readonly catalogProducts: ICatalogProductPort,
  ) {}

  async execute(input: ApplySalesOrderLineDeltasRequest): Promise<ApplySalesOrderLineDeltasResult> {
    void input.staffUserId;
    void input.wholesaleUserId;
    void input.placedByStaffUserId;

    if (!hasDeltaWork(input)) {
      return { ok: false, reason: "invalid" };
    }

    const existing = await this.salesOrders.findById(input.organizationId, input.salesOrderId);
    if (existing === null) {
      return { ok: false, reason: "not_found" };
    }
    if (input.staffUserId === undefined) {
      if (input.customerId === undefined || existing.customerId !== input.customerId) {
        return { ok: false, reason: "not_found" };
      }
    }
    if (existing.status !== "draft") {
      return { ok: false, reason: "illegal_transition" };
    }

    const customer = await this.customers.findById(input.organizationId, existing.customerId);
    if (customer === null) {
      return { ok: false, reason: "customer_not_found" };
    }

    const actor = input.staffUserId !== undefined ? "staff" : "wholesale";
    const accountStatusGate = createDraftAccountStatusGate(customer.accountStatus, actor);
    if (accountStatusGate !== null) {
      return { ok: false, reason: accountStatusGate };
    }

    const working = workingFromExisting(existing.lines);

    for (const identifier of input.remove ?? []) {
      const index = findWorkingLineIndex(working, identifier);
      if (index < 0) {
        return { ok: false, reason: "invalid" };
      }
      working.splice(index, 1);
    }

    for (const add of input.add ?? []) {
      if (!Number.isInteger(add.qty) || add.qty <= 0) {
        return { ok: false, reason: "invalid" };
      }
      let productId: ProductId;
      try {
        productId = ProductId.parse(add.productId);
      } catch {
        return { ok: false, reason: "invalid" };
      }
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
      const index = working.findIndex((line) => line.sku.value === product.sku.value);
      if (index >= 0) {
        working[index] = {
          ...working[index]!,
          qty: working[index]!.qty + add.qty,
          productId,
        };
      } else {
        working.push({
          lineId: SalesOrderLineId.parse(newUuid()),
          sku: product.sku,
          qty: add.qty,
          productId,
        });
      }
    }

    for (const update of input.update ?? []) {
      if (!Number.isInteger(update.qty) || update.qty <= 0) {
        return { ok: false, reason: "invalid" };
      }
      if (update.lineId === undefined && update.sku === undefined) {
        return { ok: false, reason: "invalid" };
      }
      const index = findUpdateTarget(working, update);
      if (index < 0) {
        return { ok: false, reason: "invalid" };
      }
      working[index] = { ...working[index]!, qty: update.qty };
    }

    if (working.length === 0) {
      const cancelled: SalesOrder = { ...existing, status: "cancelled", lines: [] };
      await this.salesOrders.save(cancelled, existing);
      return { ok: true, salesOrder: cancelled };
    }

    const lineInputs: SalesOrderLineInput[] = [];
    const unresolvedSkus = [
      ...new Set(
        working
          .filter((line) => line.productId === undefined)
          .map((line) => line.sku.value),
      ),
    ];
    const productIdBySku = new Map<string, ProductId>();
    if (unresolvedSkus.length > 0) {
      const resolved = await Promise.all(
        unresolvedSkus.map(async (skuValue) => {
          const sku = Sku.parse(skuValue);
          const product = await this.catalogProducts.findBySku(input.organizationId, sku);
          return [skuValue, product?.productId ?? null] as const;
        }),
      );
      for (const [skuValue, productId] of resolved) {
        if (productId === null) {
          return { ok: false, reason: "product_not_found" };
        }
        productIdBySku.set(skuValue, productId);
      }
    }

    for (const line of working) {
      const productId =
        line.productId ?? productIdBySku.get(line.sku.value);
      if (productId === undefined) {
        return { ok: false, reason: "product_not_found" };
      }
      lineInputs.push({ productId, qty: line.qty });
    }

    const existingQtyBySku = new Map<string, number>();
    for (const line of existing.lines) {
      existingQtyBySku.set(
        line.sku.value,
        (existingQtyBySku.get(line.sku.value) ?? 0) + line.qty,
      );
    }

    const built = await buildSalesOrderLines(
      input.organizationId,
      this.catalogProducts,
      lineInputs,
      existingQtyBySku,
      existing.lines,
    );
    if (!built.ok) {
      return built;
    }

    const salesOrder: SalesOrder = {
      ...existing,
      lines: built.lines,
    };
    await this.salesOrders.save(salesOrder, existing);
    return { ok: true, salesOrder };
  }
}
