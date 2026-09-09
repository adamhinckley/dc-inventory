import {
  canStaffPerform,
  type StaffAction,
  type StaffRole,
} from "@dc-inventory/identity";
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
  FastifySchema,
} from "fastify";
import { forbiddenResponseSchema } from "../../schemas.js";

type CustomerPatchBody = {
  creditLimitCents?: number;
  currency?: string;
  name?: string;
  terms?: string;
  taxId?: string | null;
  accountStatus?: string;
  customerNote?: string | null;
  staffNote?: string | null;
};

function updateInternalCustomerActions(request: FastifyRequest): readonly StaffAction[] {
  const body = request.body as CustomerPatchBody | undefined;
  const actions: StaffAction[] = [];
  if (body?.creditLimitCents !== undefined || body?.currency !== undefined) {
    actions.push("credit_limit_manage");
  }
  const touchesOtherFields =
    body !== undefined &&
    Object.keys(body).some((key) => key !== "creditLimitCents" && key !== "currency");
  if (touchesOtherFields) {
    actions.push("master_data_manage");
  }
  return actions.length > 0 ? actions : ["master_data_manage"];
}

const ACTION_BY_OPERATION: Readonly<
  Record<string, StaffAction | readonly StaffAction[] | ((request: FastifyRequest) => readonly StaffAction[])>
> = {
  importInternalProducts: "master_data_manage",
  createInternalProduct: "master_data_manage",
  updateInternalProduct: "master_data_manage",
  updateInternalProductBySku: "master_data_manage",
  createInternalCustomer: "master_data_manage",
  updateInternalCustomer: updateInternalCustomerActions,
  createInternalCustomerContact: "master_data_manage",
  updateInternalCustomerContact: "master_data_manage",
  createInternalCustomerShipTo: "master_data_manage",
  updateInternalCustomerShipTo: "master_data_manage",
  createInternalCustomerExemptionCertificate: "master_data_manage",
  updateInternalCustomerExemptionCertificate: "master_data_manage",
  createInternalCustomerBillTo: "master_data_manage",
  updateInternalCustomerBillTo: "master_data_manage",
  copyInternalCustomerBillToFromDefaultShipTo: "master_data_manage",
  createInternalPurchaseOrder: "purchase_orders_manage",
  draftInternalUncoveredPurchaseOrders: "purchase_orders_manage",
  syncInternalPurchaseOrdersFromUncovered: "purchase_orders_manage",
  replaceInternalPurchaseOrderLines: "purchase_orders_manage",
  confirmInternalPurchaseOrder: "purchase_orders_manage",
  unconfirmInternalPurchaseOrder: "purchase_orders_manage",
  cancelInternalPurchaseOrder: "purchase_orders_manage",
  cancelRemainingInternalPurchaseOrder: ["stock_manage", "purchase_orders_manage"],
  createInternalSupplier: "purchase_orders_manage",
  updateInternalSupplier: "purchase_orders_manage",
  assignInternalSupplierProduct: "purchase_orders_manage",
  updateInternalSupplierProduct: "purchase_orders_manage",
  unlinkInternalSupplierProduct: "purchase_orders_manage",
  receiveInternalPurchaseOrder: "stock_manage",
  reopenInternalInventorySkus: "stock_manage",
  closeInternalInventorySkus: "stock_manage",
  shipInternalSalesOrder: "stock_manage",
  createInternalSalesOrder: "sales_orders_manage",
  replaceInternalSalesOrderLines: "sales_orders_manage",
  confirmInternalSalesOrder: "sales_orders_manage",
  cancelInternalSalesOrder: "sales_orders_manage",
  recordInternalInvoicePayment: "payments_apply",
};

type OperationSchema = FastifySchema & {
  operationId?: string;
  response?: Record<number, unknown>;
};

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function operationId(schema: FastifySchema | undefined): string | undefined {
  return (schema as OperationSchema | undefined)?.operationId;
}

function asActions(
  mapped: StaffAction | readonly StaffAction[] | ((request: FastifyRequest) => readonly StaffAction[]),
  request: FastifyRequest,
): readonly StaffAction[] {
  if (typeof mapped === "function") {
    return mapped(request);
  }
  if (Array.isArray(mapped)) {
    return mapped;
  }
  return [mapped as StaffAction];
}

function actionsFor(
  schema: FastifySchema | undefined,
  request: FastifyRequest,
): readonly StaffAction[] | undefined {
  const id = operationId(schema);
  if (id === undefined) {
    return undefined;
  }
  const mapped = ACTION_BY_OPERATION[id];
  if (mapped === undefined) {
    return undefined;
  }
  return asActions(mapped, request);
}

function hasStaffActionMapping(schema: FastifySchema | undefined): boolean {
  const id = operationId(schema);
  return id !== undefined && ACTION_BY_OPERATION[id] !== undefined;
}

function sendForbidden(reply: FastifyReply) {
  return reply.code(403).send({ error: "forbidden" as const });
}

export function registerStaffActionGuard(app: FastifyInstance): void {
  app.addHook("onRoute", (route) => {
    const methods = Array.isArray(route.method) ? route.method : [route.method];
    if (!methods.some((method) => WRITE_METHODS.has(method))) {
      return;
    }
    if (!hasStaffActionMapping(route.schema)) {
      throw new Error(
        `Internal write operation ${operationId(route.schema) ?? route.url} has no staff action`,
      );
    }
    const schema = route.schema as OperationSchema;
    schema.response = {
      ...schema.response,
      403: forbiddenResponseSchema,
    };
  });

  app.addHook("preHandler", async (request: FastifyRequest, reply) => {
    const actions = actionsFor(request.routeOptions.schema, request);
    if (actions === undefined) {
      return;
    }
    const roles = request.staffAuth?.roles as readonly StaffRole[] | undefined;
    if (
      roles === undefined ||
      !actions.every((action) => canStaffPerform(roles, action))
    ) {
      return sendForbidden(reply);
    }
  });
}
