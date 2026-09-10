import {
  CustomerId,
  OrderId,
  OrganizationId,
  type StaffUserId,
  type WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import type { ICatalogProductPort } from "../domain/ports/catalog-product.js";
import type {
  ICustomerLookupPort,
  ISalesOrderRepository,
} from "../domain/ports/sales-order-repository.js";
import type { SalesOrder } from "../domain/sales-order.js";
import { normalizeSalesOrderLabel } from "../domain/sales-order.js";
import { createDraftAccountStatusGate } from "./account-status-gate.js";
import {
  buildSalesOrderLines,
  type SalesOrderLineInput,
} from "./build-sales-order-lines.js";
import type { ConfirmSalesOrderShortage } from "./confirm-sales-order.js";

export type ReplaceSalesOrderLinesRequest = {
  organizationId: OrganizationId;
  customerId?: CustomerId;
  salesOrderId: OrderId;
  lines: readonly SalesOrderLineInput[];
  /** undefined keeps the current cart name; null clears it; string renames. */
  label?: string | null;
  shipLine1?: string;
  shipLine2?: string | null;
  shipCity?: string;
  shipRegion?: string;
  shipPostal?: string;
  shipCountry?: string;
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

export type ReplaceSalesOrderLinesResult =
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

function applyLabel(
  existing: string | undefined,
  requested: string | null | undefined,
): string | undefined {
  const normalized = normalizeSalesOrderLabel(requested);
  if (normalized === undefined) {
    return existing;
  }
  return normalized === null ? undefined : normalized;
}

export class ReplaceSalesOrderLinesUseCase {
  constructor(
    private readonly salesOrders: ISalesOrderRepository,
    private readonly customers: ICustomerLookupPort,
    private readonly catalogProducts: ICatalogProductPort,
  ) {}

  async execute(input: ReplaceSalesOrderLinesRequest): Promise<ReplaceSalesOrderLinesResult> {
    void input.staffUserId;
    void input.wholesaleUserId;
    void input.placedByStaffUserId;

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

    if (input.lines.length === 0) {
      const cancelled: SalesOrder = { ...existing, status: "cancelled", lines: [] };
      await this.salesOrders.save(cancelled, existing);
      return { ok: true, salesOrder: cancelled };
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
      input.lines,
      existingQtyBySku,
      existing.lines,
    );
    if (!built.ok) {
      return built;
    }

    const { label: existingLabel, ...existingWithoutLabel } = existing;
    const nextLabel = applyLabel(existingLabel, input.label);
    const salesOrder: SalesOrder = {
      ...existingWithoutLabel,
      ...(nextLabel !== undefined ? { label: nextLabel } : {}),
      lines: built.lines,
      shipLine1: input.shipLine1 ?? existing.shipLine1,
      shipLine2: input.shipLine2 ?? existing.shipLine2,
      shipCity: input.shipCity ?? existing.shipCity,
      shipRegion: input.shipRegion ?? existing.shipRegion,
      shipPostal: input.shipPostal ?? existing.shipPostal,
      shipCountry: input.shipCountry ?? existing.shipCountry,
    };
    await this.salesOrders.save(salesOrder, existing);
    return { ok: true, salesOrder };
  }
}
