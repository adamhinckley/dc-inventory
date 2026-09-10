import {
  CustomerId,
  OrderId,
  OrganizationId,
  type StaffUserId,
} from "@dc-inventory/shared-kernel";
import { SalesTransactionError } from "../domain/errors.js";
import type { ICustomerShipToSnapshotReadPort } from "../domain/ports/customer-ship-to-snapshot-read.js";
import type { ICreditCheckPort } from "../domain/ports/credit-check.js";
import type {
  ICustomerLookupPort,
  ISalesUnitOfWork,
} from "../domain/ports/sales-order-repository.js";
import type { SalesOrder, SalesOrderLine } from "../domain/sales-order.js";
import { confirmAccountStatusGate } from "./account-status-gate.js";

export type ConfirmSalesOrderRequest = {
  organizationId: OrganizationId;
  staffUserId: StaffUserId;
  salesOrderId: OrderId;
  idempotencyKey: string;
  shipToId: string;
  /** When set, the order must belong to this customer (wholesale session gate). */
  customerId?: CustomerId;
  /** Staff-only: confirm when available credit is below the order total. */
  overrideCredit?: boolean;
};

export type ConfirmSalesOrderShortage = {
  sku: string;
  name: string;
  requestedQty: number;
  availableQty: number;
};

export type ConfirmSalesOrderResult =
  | { ok: true; salesOrder: SalesOrder }
  | {
      ok: false;
      reason:
        | "not_found"
        | "illegal_transition"
        | "empty_order"
        | "inventory_conflict"
        | "idempotency_conflict"
        | "customer_on_hold"
        | "customer_inactive"
        | "customer_not_found"
        | "ship_to_not_found"
        | "credit_exceeded";
      availableCreditCents?: number;
      orderTotalCents?: number;
    }
  | { ok: false; reason: "insufficient_atp"; shortage?: ConfirmSalesOrderShortage };

function computeOrderTotalCents(lines: readonly SalesOrderLine[]): number {
  return lines.reduce((sum, line) => sum + line.qty * line.unitPrice.amountMinor, 0);
}

function applyShipToSnapshot(
  order: SalesOrder,
  snapshot: {
    line1: string;
    line2: string | null;
    city: string;
    region: string;
    postal: string;
    country: string;
  },
): SalesOrder {
  return {
    ...order,
    shipLine1: snapshot.line1,
    shipLine2: snapshot.line2,
    shipCity: snapshot.city,
    shipRegion: snapshot.region,
    shipPostal: snapshot.postal,
    shipCountry: snapshot.country,
  };
}

export class ConfirmSalesOrderUseCase {
  constructor(
    private readonly uow: ISalesUnitOfWork,
    private readonly customers: ICustomerLookupPort,
    private readonly shipTos: ICustomerShipToSnapshotReadPort,
    private readonly creditCheck: ICreditCheckPort,
  ) {}

  async execute(input: ConfirmSalesOrderRequest): Promise<ConfirmSalesOrderResult> {
    try {
      return await this.uow.run(async (scope) => {
        const existing = await scope.salesOrders.findById(
          input.organizationId,
          input.salesOrderId,
        );
        if (existing === null) {
          return { ok: false, reason: "not_found" };
        }
        if (input.customerId !== undefined && existing.customerId !== input.customerId) {
          return { ok: false, reason: "not_found" };
        }
        if (existing.status === "confirmed") {
          for (const line of existing.lines) {
            const matches = await scope.inventory.matchesCommittedIdempotency({
              organizationId: existing.organizationId,
              idempotencyKey: `${input.idempotencyKey}:confirm:${line.id}`,
              sku: line.sku,
              quantity: line.qty,
              orderId: existing.id,
            });
            if (!matches) {
              return { ok: false, reason: "illegal_transition" };
            }
          }
          return { ok: true, salesOrder: existing };
        }
        if (existing.status !== "draft") {
          return { ok: false, reason: "illegal_transition" };
        }
        if (existing.lines.length === 0) {
          return { ok: false, reason: "empty_order" };
        }

        const customer = await this.customers.findById(
          input.organizationId,
          existing.customerId,
        );
        if (customer === null) {
          return { ok: false, reason: "customer_not_found" };
        }
        const accountStatusGate = confirmAccountStatusGate(customer.accountStatus);
        if (accountStatusGate !== null) {
          return { ok: false, reason: accountStatusGate };
        }

        const shipToSnapshot = await this.shipTos.getShipToAddressSnapshot(
          input.organizationId,
          existing.customerId,
          input.shipToId,
        );
        if (shipToSnapshot === null) {
          return { ok: false, reason: "ship_to_not_found" };
        }

        const orderTotalCents = computeOrderTotalCents(existing.lines);
        if (!input.overrideCredit) {
          const availableCreditCents = await this.creditCheck.availableCredit(
            input.organizationId,
            existing.customerId,
          );
          if (availableCreditCents < orderTotalCents) {
            return {
              ok: false,
              reason: "credit_exceeded",
              availableCreditCents,
              orderTotalCents,
            };
          }
        }

        await scope.inventory.lockSnapshots(
          existing.lines.map((line) => ({
            organizationId: existing.organizationId,
            sku: line.sku,
          })),
        );
        const commitResult = await scope.inventory.recordCommittedBulk(
          existing.lines.map((line) => ({
            organizationId: existing.organizationId,
            idempotencyKey: `${input.idempotencyKey}:confirm:${line.id}`,
            sku: line.sku,
            quantity: line.qty,
            orderId: existing.id,
          })),
        );
        if (!commitResult.ok) {
          const failedLine =
            existing.lines.find(
              (line) =>
                commitResult.failedIdempotencyKey ===
                `${input.idempotencyKey}:confirm:${line.id}`,
            ) ?? existing.lines[0];
          if (commitResult.reason === "idempotency_conflict") {
            throw new SalesTransactionError("idempotency_conflict");
          }
          if (
            commitResult.reason === "insufficient_available_to_sell" ||
            commitResult.reason === "insufficient_available"
          ) {
            throw new SalesTransactionError("insufficient_atp", {
              sku: failedLine?.sku.value ?? "",
              name: failedLine?.name ?? "",
              requestedQty: failedLine?.qty ?? 0,
              availableQty: commitResult.availableToSell ?? 0,
            });
          }
          throw new SalesTransactionError("inventory_conflict");
        }

        const updated: SalesOrder = applyShipToSnapshot(
          {
            ...existing,
            status: "confirmed",
            ...(input.overrideCredit
              ? { creditLimitOverriddenByStaffUserId: input.staffUserId }
              : {}),
          },
          shipToSnapshot,
        );
        await scope.salesOrders.save(updated);
        return { ok: true, salesOrder: updated };
      });
    } catch (error) {
      if (error instanceof SalesTransactionError) {
        if (error.reason === "insufficient_atp") {
          const shortage =
            error.shortage !== undefined && "availableQty" in error.shortage
              ? error.shortage
              : undefined;
          return { ok: false, reason: "insufficient_atp", shortage };
        }
        return {
          ok: false,
          reason: error.reason as Exclude<
            ConfirmSalesOrderResult extends { ok: false; reason: infer R } ? R : never,
            "insufficient_atp"
          >,
        };
      }
      throw error;
    }
  }
}
