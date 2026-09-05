import {
  CustomerId,
  OrderId,
  OrganizationId,
  ProductId,
  type StaffUserId,
  type WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import { isSalesDraftPerCustomerUniqueViolation } from "../adapters/postgres-sales-draft-unique.js";
import type { IClock } from "../domain/clock.js";
import { newUuid, SalesOrderLineId } from "../domain/ids.js";
import type { ICatalogProductPort } from "../domain/ports/catalog-product.js";
import type {
  ICustomerLookupPort,
  ISalesOrderRepository,
} from "../domain/ports/sales-order-repository.js";
import type { SalesOrder, SalesOrderLine } from "../domain/sales-order.js";
import { createDraftAccountStatusGate } from "./account-status-gate.js";
import {
  buildSalesOrderLines,
  type SalesOrderLineInput,
} from "./build-sales-order-lines.js";

export type CreateSalesOrderLineInput = SalesOrderLineInput;

type CreateSalesOrderRequestBase = {
  organizationId: OrganizationId;
  customerId: CustomerId;
  lines: readonly CreateSalesOrderLineInput[];
  /** Default find-or-create for cart; seed replay passes always_new. */
  mode?: "find_or_create" | "always_new";
  shipLine1?: string;
  shipLine2?: string | null;
  shipCity?: string;
  shipRegion?: string;
  shipPostal?: string;
  shipCountry?: string;
};

export type CreateSalesOrderRequest = CreateSalesOrderRequestBase &
  (
    | { staffUserId: StaffUserId; wholesaleUserId?: never; placedByStaffUserId?: never }
    | { wholesaleUserId: WholesaleUserId; staffUserId?: never; placedByStaffUserId?: never }
    | { placedByStaffUserId: StaffUserId; staffUserId?: never; wholesaleUserId?: never }
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
        | "product_organization_mismatch"
        | "customer_on_hold"
        | "customer_inactive";
    };

function mergeDraftLines(
  existingLines: readonly SalesOrderLine[],
  incomingLines: readonly SalesOrderLine[],
): SalesOrderLine[] {
  const merged: SalesOrderLine[] = [];
  const consumedIncoming = new Set<string>();

  for (const existing of existingLines) {
    const incoming = incomingLines.find((line) => line.sku.equals(existing.sku));
    if (incoming === undefined) {
      merged.push(existing);
      continue;
    }
    consumedIncoming.add(incoming.sku.value);
    merged.push({
      ...existing,
      qty: existing.qty + incoming.qty,
      unitPrice: incoming.unitPrice,
      name: incoming.name,
      taxCategoryCode: incoming.taxCategoryCode,
    });
  }

  for (const incoming of incomingLines) {
    if (!consumedIncoming.has(incoming.sku.value)) {
      merged.push(incoming);
    }
  }

  return merged;
}

function applyShipToSnapshot(
  existingDraft: SalesOrder,
  input: CreateSalesOrderRequestBase,
): SalesOrder {
  return {
    ...existingDraft,
    shipLine1: input.shipLine1 ?? existingDraft.shipLine1,
    shipLine2: input.shipLine2 ?? existingDraft.shipLine2,
    shipCity: input.shipCity ?? existingDraft.shipCity,
    shipRegion: input.shipRegion ?? existingDraft.shipRegion,
    shipPostal: input.shipPostal ?? existingDraft.shipPostal,
    shipCountry: input.shipCountry ?? existingDraft.shipCountry,
  };
}

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
    void input.placedByStaffUserId;
    if (input.lines.length === 0) {
      return { ok: false, reason: "empty_order" };
    }

    const customer = await this.customers.findById(input.organizationId, input.customerId);
    if (customer === null) {
      return { ok: false, reason: "customer_not_found" };
    }

    const actor = input.staffUserId !== undefined ? "staff" : "wholesale";
    const accountStatusGate = createDraftAccountStatusGate(customer.accountStatus, actor);
    if (accountStatusGate !== null) {
      return { ok: false, reason: accountStatusGate };
    }

    const builtIncoming = await buildSalesOrderLines(
      input.organizationId,
      this.catalogProducts,
      input.lines,
    );
    if (!builtIncoming.ok) {
      return builtIncoming;
    }

    if (input.mode === "always_new") {
      const createdAt = this.clock?.now() ?? new Date();
      const salesOrder = await this.salesOrders.insertWithNextDocumentNumber({
        id: OrderId.parse(newUuid()),
        organizationId: input.organizationId,
        customerId: input.customerId,
        status: "draft",
        createdAt,
        lines: builtIncoming.lines,
        placedByStaffUserId: input.placedByStaffUserId,
        shipLine1: input.shipLine1,
        shipLine2: input.shipLine2,
        shipCity: input.shipCity,
        shipRegion: input.shipRegion,
        shipPostal: input.shipPostal,
        shipCountry: input.shipCountry,
      });
      return { ok: true, salesOrder };
    }

    return this.salesOrders.runDraftCustomerTransaction(
      input.organizationId,
      input.customerId,
      async (repo) => this.findOrCreateDraft(repo, input, builtIncoming.lines),
    );
  }

  private async findOrCreateDraft(
    repo: ISalesOrderRepository,
    input: CreateSalesOrderRequest,
    incomingLines: readonly SalesOrderLine[],
  ): Promise<CreateSalesOrderResult> {
    const existingDraft = await repo.findDraftByCustomerForUpdate(
      input.organizationId,
      input.customerId,
    );
    if (existingDraft !== null) {
      const salesOrder: SalesOrder = applyShipToSnapshot(
        {
          ...existingDraft,
          lines: mergeDraftLines(existingDraft.lines, incomingLines),
        },
        input,
      );
      await repo.save(salesOrder);
      return { ok: true, salesOrder };
    }

    try {
      const createdAt = this.clock?.now() ?? new Date();
      const salesOrder = await repo.insertWithNextDocumentNumber({
        id: OrderId.parse(newUuid()),
        organizationId: input.organizationId,
        customerId: input.customerId,
        status: "draft",
        createdAt,
        lines: incomingLines,
        placedByStaffUserId: input.placedByStaffUserId,
        shipLine1: input.shipLine1,
        shipLine2: input.shipLine2,
        shipCity: input.shipCity,
        shipRegion: input.shipRegion,
        shipPostal: input.shipPostal,
        shipCountry: input.shipCountry,
      });
      return { ok: true, salesOrder };
    } catch (error) {
      if (!isSalesDraftPerCustomerUniqueViolation(error)) {
        throw error;
      }
      const draft = await repo.findDraftByCustomerForUpdate(
        input.organizationId,
        input.customerId,
      );
      if (draft === null) {
        throw error;
      }
      const salesOrder: SalesOrder = applyShipToSnapshot(
        {
          ...draft,
          lines: mergeDraftLines(draft.lines, incomingLines),
        },
        input,
      );
      await repo.save(salesOrder);
      return { ok: true, salesOrder };
    }
  }
}
