import {
  CustomerId,
  OrderId,
  OrganizationId,
  type StaffUserId,
  type WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import type { IClock } from "../domain/clock.js";
import { newUuid } from "../domain/ids.js";
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

export type CreateSalesOrderLineInput = SalesOrderLineInput;

type CreateSalesOrderRequestBase = {
  organizationId: OrganizationId;
  customerId: CustomerId;
  lines: readonly CreateSalesOrderLineInput[];
  /** Buyer-facing cart name ("Spring reorder"). Optional; blank is dropped. */
  label?: string | null;
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
        | "customer_inactive"
        | "insufficient_atp";
      shortage?: ConfirmSalesOrderShortage;
    };

/**
 * Every call opens a new draft. A customer may hold many open carts at once;
 * the shop picks which draft to PATCH, this use case never merges into one.
 */
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

    const built = await buildSalesOrderLines(
      input.organizationId,
      this.catalogProducts,
      input.lines,
    );
    if (!built.ok) {
      return built;
    }

    const label = normalizeSalesOrderLabel(input.label);
    const createdAt = this.clock?.now() ?? new Date();
    const salesOrder = await this.salesOrders.insertWithNextDocumentNumber({
      id: OrderId.parse(newUuid()),
      organizationId: input.organizationId,
      customerId: input.customerId,
      status: "draft",
      createdAt,
      lines: built.lines,
      ...(typeof label === "string" ? { label } : {}),
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
}
