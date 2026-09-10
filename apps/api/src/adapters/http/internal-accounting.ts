import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { FastifySchema } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  deriveInvoiceStatus,
  PaymentId,
  PaymentPlanId,
  type CustomerBalancesSortBy,
  type CustomerArStats,
  type Invoice,
  type Payment,
  type PaymentApplication,
  type PaymentPlan,
  type PaymentPlanExpectations,
  type PaymentsReceivedSortBy,
} from "@dc-inventory/accounting";
import {
  CustomerId,
  InvoiceId,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import { z } from "zod";
import {
  accountingSummaryQuerySchema,
  accountingSummaryResponseSchema,
  agingBucketSchema,
  adjustInvoiceBodySchema,
  adjustInvoiceResponseSchema,
  agingBucketsSchema,
  conflictResponseSchema,
  customerAccountingQuerySchema,
  customerAccountingSummarySchema,
  customerAccountingWorkspaceResponseSchema,
  customerArInvoiceListResponseSchema,
  customerBalancesListQuerySchema,
  customerBalancesListResponseSchema,
  customerBalancesListTable,
  customerIdParamsSchema,
  customerInvoicesQuerySchema,
  customerPaymentListResponseSchema,
  invoiceIdParamsSchema,
  invalidResponseSchema,
  notFoundResponseSchema,
  overpayResponseSchema,
  paymentIdParamsSchema,
  paymentsReceivedListQuerySchema,
  paymentsReceivedListResponseSchema,
  paymentsReceivedListTable,
  recordCustomerPaymentBodySchema,
  recordCustomerPaymentResponseSchema,
  reallocatePaymentBodySchema,
  reallocatePaymentResponseSchema,
  setPaymentPlanBodySchema,
  paymentPlanItemSchema,
  unauthorizedResponseSchema,
  voidPaymentBodySchema,
  voidPaymentResponseSchema,
  wrongCurrencyResponseSchema,
  zodValidationErrorResponseSchema,
} from "../../schemas.js";
import { staffOrganizationId } from "./org-session.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

function staffUserId(request: { staffAuth?: { staffUserId: string } }): StaffUserId {
  return StaffUserId.parse(request.staffAuth?.staffUserId ?? "");
}

function resolveAsOf(value: Date | undefined, fallback: Date): Date {
  return value ?? fallback;
}

const customerBalanceSortByMap: Record<
  z.infer<typeof import("../../schemas.js").customerBalancesListQuerySchema>["sortBy"],
  CustomerBalancesSortBy
> = {
  pastDueCents: "pastDue",
  openBalanceCents: "openBalance",
  name: "name",
  customerNumber: "customerNumber",
  oldestDueDate: "oldestDue",
  daysPastDue: "daysPastDue",
  creditLimitCents: "creditLimit",
  availableCreditCents: "availableCredit",
};

const paymentsReceivedSortByMap: Record<
  z.infer<typeof import("../../schemas.js").paymentsReceivedListQuerySchema>["sortBy"],
  PaymentsReceivedSortBy
> = {
  receivedAt: "receivedAt",
  amountCents: "amount",
  customerName: "customerName",
};

function sendNotFound(reply: FastifyReply) {
  return reply.code(404).send({ error: "not_found" as const });
}

function sendInvalid(reply: FastifyReply) {
  return reply.code(400).send({ error: "invalid" as const });
}

function sendConflict(reply: FastifyReply) {
  return reply.code(409).send({ error: "conflict" as const });
}

function sendOverpay(reply: FastifyReply) {
  return reply.code(409).send({ error: "overpay" as const });
}

function sendWrongCurrency(reply: FastifyReply) {
  return reply.code(400).send({ error: "wrong_currency" as const });
}

function mapAgingBuckets(aging: Readonly<Record<string, number>>) {
  return agingBucketsSchema.parse(aging);
}

function mapStats(stats: CustomerArStats) {
  return {
    highestInvoiceCents: stats.highestInvoiceCents,
    avgInvoiceCents: stats.avgInvoiceCents,
    openInvoiceCount: stats.openInvoiceCount,
    totalOpenInvoiceAmountCents: stats.totalOpenInvoiceAmountCents,
    creditMemoCount: stats.creditMemoCount,
    totalCreditMemoCents: stats.totalCreditMemoCents,
    totalWriteOffsCents: stats.totalWriteOffsCents,
    openBalanceCents: stats.openBalanceCents,
    creditLimitCents: stats.creditLimitCents,
    availableCreditCents: stats.availableCreditCents,
    unappliedCreditCents: stats.unappliedCreditCents,
    dateOfFirstShipment: stats.dateOfFirstShipment,
    dateOfLastShipment: stats.dateOfLastShipment,
    dateOfLastOrder: stats.dateOfLastOrder,
    avgDaysToPay: stats.avgDaysToPay,
    lastYtdSalesCents: stats.lastYtdSalesCents,
    ytdSalesCents: stats.ytdSalesCents,
    lytdVsYtdPercent: stats.lytdVsYtdPercent,
    lastYearSalesCents: stats.lastYearSalesCents,
    totalSalesCents: stats.totalSalesCents,
  };
}

function mapPaymentPlan(plan: PaymentPlan) {
  return {
    id: plan.id,
    frequency: plan.frequency,
    installmentAmountCents: plan.installmentAmountCents,
    currency: plan.currency,
    startsOn: plan.startsOn,
    endedAt: plan.endedAt,
    createdAt: plan.createdAt,
  };
}

function mapPlanExpectations(expectations: PaymentPlanExpectations) {
  return {
    nextExpectedOn: expectations.nextExpectedOn,
    estimatedEndOn: expectations.estimatedEndOn,
    installmentsReceived: expectations.installmentsReceived,
    installmentsExpectedSoFar: expectations.installmentsExpectedSoFar,
    missedInstallments: expectations.missedInstallments,
    complete: expectations.complete,
  };
}

function mapInvoiceRow(
  invoice: Invoice,
  remainingCents: number,
  status: ReturnType<typeof deriveInvoiceStatus>,
) {
  return {
    id: invoice.id,
    orderId: invoice.orderId,
    documentNumber: invoice.documentNumber,
    postedAt: invoice.postedAt,
    dueDate: invoice.dueDate,
    terms: invoice.terms,
    totalCents: invoice.total.amountMinor,
    remainingCents,
    currency: invoice.total.currency,
    status,
  };
}

function mapPaymentApplication(application: PaymentApplication) {
  return {
    id: application.id,
    invoiceId: application.invoiceId,
    amountCents: application.amount.amountMinor,
    currency: application.amount.currency,
    createdAt: application.createdAt,
  };
}

function mapCustomerPaymentRow(input: {
  payment: Payment;
  appliedCents: number;
  unappliedCents: number;
  applications: readonly PaymentApplication[];
  voided: boolean;
}) {
  return {
    id: input.payment.id,
    amountCents: input.payment.amount.amountMinor,
    currency: input.payment.amount.currency,
    method: input.payment.method ?? "other",
    reference: input.payment.reference ?? null,
    note: input.payment.note ?? null,
    receivedAt: input.payment.receivedAt ?? input.payment.createdAt,
    appliedCents: input.appliedCents,
    unappliedCents: input.unappliedCents,
    voided: input.voided,
    voidReason: input.payment.voidReason ?? null,
    applications: input.applications.map(mapPaymentApplication),
  };
}

function mapSummaryResponse(result: {
  asOf: Date;
  aging: Readonly<Record<string, number>>;
  unappliedCreditCents: number;
  openBalanceCents: number;
  openBalanceOwedCents: number;
  exposureCents: number;
  availableCreditCents: number;
  stats: CustomerArStats;
  plan: PaymentPlan | null;
  planExpectations: PaymentPlanExpectations | null;
}) {
  return {
    asOf: result.asOf,
    aging: mapAgingBuckets(result.aging),
    unappliedCreditCents: result.unappliedCreditCents,
    openBalanceCents: result.openBalanceCents,
    openBalanceOwedCents: result.openBalanceOwedCents,
    exposureCents: result.exposureCents,
    availableCreditCents: result.availableCreditCents,
    stats: mapStats(result.stats),
    plan: result.plan === null ? null : mapPaymentPlan(result.plan),
    planExpectations:
      result.planExpectations === null
        ? null
        : mapPlanExpectations(result.planExpectations),
  };
}

async function ensureCustomerExists(request: FastifyRequest, reply: FastifyReply, customerId: CustomerId) {
  const result = await request.server.customers.getCustomer.execute({
    organizationId: staffOrganizationId(request),
    staffUserId: staffUserId(request),
    customerId,
  });
  if (!result.ok) {
    sendNotFound(reply);
    return false;
  }
  return true;
}

const readErrors = {
  401: unauthorizedResponseSchema,
  404: notFoundResponseSchema,
};

const writeErrors = {
  400: z.union([zodValidationErrorResponseSchema, invalidResponseSchema, wrongCurrencyResponseSchema]),
  401: unauthorizedResponseSchema,
  404: notFoundResponseSchema,
  409: conflictResponseSchema.or(overpayResponseSchema),
};

export function registerInternalAccountingRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.get(
    "/customers/:id/accounting",
    {
      schema: {
        operationId: "getInternalCustomerAccounting",
        tags: ["internal"],
        summary: "Get customer accounting summary",
        params: customerIdParamsSchema,
        querystring: customerAccountingQuerySchema,
        response: {
          200: customerAccountingSummarySchema,
          ...readErrors,
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const query = request.query as { asOf?: Date };
      const customerId = CustomerId.parse(params.id);
      if (!(await ensureCustomerExists(request, reply, customerId))) {
        return;
      }
      const asOf = resolveAsOf(query.asOf, new Date());
      const result = await request.server.accounting.getCustomerAccountingSummary.execute({
        organizationId: staffOrganizationId(request),
        customerId,
        asOf,
      });
      return mapSummaryResponse(result);
    },
  );

  routes.get(
    "/customers/:id/accounting/workspace",
    {
      schema: {
        operationId: "getInternalCustomerAccountingWorkspace",
        tags: ["internal"],
        summary: "Get customer accounting workspace bundle",
        params: customerIdParamsSchema,
        querystring: customerAccountingQuerySchema,
        response: {
          200: customerAccountingWorkspaceResponseSchema,
          ...readErrors,
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const query = request.query as { asOf?: Date };
      const customerId = CustomerId.parse(params.id);
      if (!(await ensureCustomerExists(request, reply, customerId))) {
        return;
      }
      const asOf = resolveAsOf(query.asOf, new Date());
      const result = await request.server.accounting.getCustomerAccountingWorkspace.execute({
        organizationId: staffOrganizationId(request),
        customerId,
        asOf,
      });
      return {
        summary: mapSummaryResponse(result.summary),
        invoices: result.invoices.map((row) =>
          mapInvoiceRow(row.invoice, row.remainingCents, row.status),
        ),
        payments: result.payments.map(mapCustomerPaymentRow),
      };
    },
  );

  routes.get(
    "/customers/:id/invoices",
    {
      schema: {
        operationId: "listInternalCustomerInvoices",
        tags: ["internal"],
        summary: "List customer invoices with derived status",
        params: customerIdParamsSchema,
        querystring: customerInvoicesQuerySchema,
        response: {
          200: customerArInvoiceListResponseSchema,
          ...readErrors,
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const query = request.query as { includePaid?: boolean; asOf?: Date };
      const customerId = CustomerId.parse(params.id);
      if (!(await ensureCustomerExists(request, reply, customerId))) {
        return;
      }
      const asOf = resolveAsOf(query.asOf, new Date());
      const result = await request.server.accounting.listCustomerInvoices.execute({
        organizationId: staffOrganizationId(request),
        customerId,
        asOf,
        includePaid: query.includePaid === true,
      });
      return {
        items: result.items.map((row) =>
          mapInvoiceRow(row.invoice, row.remainingCents, row.status),
        ),
      };
    },
  );

  routes.get(
    "/customers/:id/payments",
    {
      schema: {
        operationId: "listInternalCustomerPayments",
        tags: ["internal"],
        summary: "List customer payments with applications and void state",
        params: customerIdParamsSchema,
        querystring: customerAccountingQuerySchema,
        response: {
          200: customerPaymentListResponseSchema,
          ...readErrors,
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const query = request.query as { asOf?: Date };
      const customerId = CustomerId.parse(params.id);
      if (!(await ensureCustomerExists(request, reply, customerId))) {
        return;
      }
      const asOf = resolveAsOf(query.asOf, new Date());
      const result = await request.server.accounting.listCustomerPayments.execute({
        organizationId: staffOrganizationId(request),
        customerId,
        asOf,
      });
      return {
        items: result.items.map(mapCustomerPaymentRow),
      };
    },
  );

  routes.post(
    "/customers/:id/payments",
    {
      schema: {
        operationId: "recordInternalCustomerPayment",
        tags: ["internal"],
        summary: "Record a customer payment with explicit applications",
        params: customerIdParamsSchema,
        body: recordCustomerPaymentBodySchema,
        response: {
          200: recordCustomerPaymentResponseSchema,
          ...writeErrors,
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const body = request.body as {
        amountCents: number;
        currency: string;
        method: "check" | "card" | "ach" | "cash" | "other";
        reference?: string | null;
        note?: string | null;
        receivedAt?: Date;
        idempotencyKey: string;
        holdRemainderAsCredit: boolean;
        applications: Array<{ invoiceId: string; amountCents: number }>;
      };
      const customerId = CustomerId.parse(params.id);
      if (!(await ensureCustomerExists(request, reply, customerId))) {
        return;
      }
      const result = await request.server.accounting.recordCustomerPayment.execute({
        staffUserId: staffUserId(request),
        organizationId: staffOrganizationId(request),
        customerId,
        amountCents: body.amountCents,
        currency: body.currency,
        method: body.method,
        reference: body.reference,
        note: body.note,
        receivedAt: body.receivedAt,
        idempotencyKey: body.idempotencyKey,
        holdRemainderAsCredit: body.holdRemainderAsCredit,
        applications: body.applications.map((row) => ({
          invoiceId: InvoiceId.parse(row.invoiceId),
          amountCents: row.amountCents,
        })),
      });
      if (!result.ok) {
        if (result.reason === "not_found") {
          return sendNotFound(reply);
        }
        if (result.reason === "conflict") {
          return sendConflict(reply);
        }
        if (result.reason === "overpay") {
          return sendOverpay(reply);
        }
        if (result.reason === "wrong_currency") {
          return sendWrongCurrency(reply);
        }
        return sendInvalid(reply);
      }
      return {
        paymentId: result.paymentId,
        unappliedCents: result.unappliedCents,
        remainingByInvoiceId: result.remainingByInvoiceId,
      };
    },
  );

  routes.post(
    "/payments/:id/reallocate",
    {
      schema: {
        operationId: "reallocateInternalPayment",
        tags: ["internal"],
        summary: "Reallocate payment amounts across invoices",
        params: paymentIdParamsSchema,
        body: reallocatePaymentBodySchema,
        response: {
          200: reallocatePaymentResponseSchema,
          ...writeErrors,
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const body = request.body as {
        applications: Array<{ invoiceId: string; deltaCents: number }>;
      };
      const result = await request.server.accounting.reallocatePayment.execute({
        staffUserId: staffUserId(request),
        organizationId: staffOrganizationId(request),
        paymentId: PaymentId.parse(params.id),
        applications: body.applications.map((row) => ({
          invoiceId: InvoiceId.parse(row.invoiceId),
          deltaCents: row.deltaCents,
        })),
      });
      if (!result.ok) {
        if (result.reason === "not_found") {
          return sendNotFound(reply);
        }
        if (result.reason === "overpay") {
          return sendOverpay(reply);
        }
        if (result.reason === "wrong_currency") {
          return sendWrongCurrency(reply);
        }
        return sendInvalid(reply);
      }
      return { unappliedCents: result.unappliedCents };
    },
  );

  routes.post(
    "/payments/:id/void",
    {
      schema: {
        operationId: "voidInternalPayment",
        tags: ["internal"],
        summary: "Void a payment",
        params: paymentIdParamsSchema,
        body: voidPaymentBodySchema,
        response: {
          200: voidPaymentResponseSchema,
          400: z.union([zodValidationErrorResponseSchema, invalidResponseSchema]),
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
          409: conflictResponseSchema,
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const body = request.body as { voidReason: string };
      const result = await request.server.accounting.voidPayment.execute({
        staffUserId: staffUserId(request),
        organizationId: staffOrganizationId(request),
        paymentId: PaymentId.parse(params.id),
        voidReason: body.voidReason,
      });
      if (!result.ok) {
        if (result.reason === "not_found") {
          return sendNotFound(reply);
        }
        if (result.reason === "conflict") {
          return sendConflict(reply);
        }
        return sendInvalid(reply);
      }
      return { unappliedCents: result.unappliedCents };
    },
  );

  routes.post(
    "/invoices/:id/adjustments",
    {
      schema: {
        operationId: "adjustInternalInvoice",
        tags: ["internal"],
        summary: "Adjust an invoice balance",
        params: invoiceIdParamsSchema,
        body: adjustInvoiceBodySchema,
        response: {
          200: adjustInvoiceResponseSchema,
          400: z.union([zodValidationErrorResponseSchema, invalidResponseSchema]),
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const body = request.body as {
        kind: "write_off" | "credit_memo";
        amountCents: number;
        reason: string;
      };
      const result = await request.server.accounting.adjustInvoice.execute({
        staffUserId: staffUserId(request),
        organizationId: staffOrganizationId(request),
        invoiceId: InvoiceId.parse(params.id),
        kind: body.kind,
        amountCents: body.amountCents,
        reason: body.reason,
      });
      if (!result.ok) {
        if (result.reason === "not_found") {
          return sendNotFound(reply);
        }
        return sendInvalid(reply);
      }
      return { remainingCents: result.remainingCents };
    },
  );

  routes.put(
    "/customers/:id/payment-plan",
    {
      schema: {
        operationId: "setInternalCustomerPaymentPlan",
        tags: ["internal"],
        summary: "Create a customer payment plan",
        params: customerIdParamsSchema,
        body: setPaymentPlanBodySchema,
        response: {
          200: paymentPlanItemSchema,
          400: z.union([zodValidationErrorResponseSchema, invalidResponseSchema]),
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
          409: conflictResponseSchema,
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const body = request.body as {
        frequency: "weekly" | "monthly";
        installmentAmountCents: number;
        currency: string;
        startsOn: Date;
      };
      const customerId = CustomerId.parse(params.id);
      if (!(await ensureCustomerExists(request, reply, customerId))) {
        return;
      }
      const result = await request.server.accounting.setPaymentPlan.execute({
        staffUserId: staffUserId(request),
        organizationId: staffOrganizationId(request),
        customerId,
        frequency: body.frequency,
        installmentAmountCents: body.installmentAmountCents,
        currency: body.currency,
        startsOn: body.startsOn,
      });
      if (!result.ok) {
        if (result.reason === "conflict") {
          return sendConflict(reply);
        }
        return sendInvalid(reply);
      }
      return mapPaymentPlan(result.plan);
    },
  );

  routes.delete(
    "/customers/:id/payment-plan",
    {
      schema: {
        operationId: "endInternalCustomerPaymentPlan",
        tags: ["internal"],
        summary: "End the active customer payment plan",
        params: customerIdParamsSchema,
        response: {
          204: z.null(),
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
          409: conflictResponseSchema,
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const customerId = CustomerId.parse(params.id);
      if (!(await ensureCustomerExists(request, reply, customerId))) {
        return;
      }
      const activePlan = await request.server.accounting.findActivePaymentPlan(
        staffOrganizationId(request),
        customerId,
      );
      if (activePlan === null) {
        return sendNotFound(reply);
      }
      const result = await request.server.accounting.endPaymentPlan.execute({
        staffUserId: staffUserId(request),
        organizationId: staffOrganizationId(request),
        planId: PaymentPlanId.parse(activePlan.id),
      });
      if (!result.ok) {
        if (result.reason === "not_found") {
          return sendNotFound(reply);
        }
        return sendConflict(reply);
      }
      return reply.code(204).send(null);
    },
  );

  routes.get(
    "/accounting/summary",
    {
      schema: {
        operationId: "getInternalAccountingSummary",
        tags: ["internal"],
        summary: "Get business-wide AR summary totals and aging",
        querystring: accountingSummaryQuerySchema,
        response: {
          200: accountingSummaryResponseSchema,
          401: unauthorizedResponseSchema,
        },
      } as FastifySchema,
    },
    async (request) => {
      const query = request.query as { asOf?: Date };
      const asOf = resolveAsOf(query.asOf, new Date());
      const result = await request.server.accounting.getAccountingSummary.execute({
        organizationId: staffOrganizationId(request),
        asOf,
      });
      return {
        asOf: result.asOf,
        totalOpenArCents: result.totalOpenArCents,
        pastDueCents: result.pastDueCents,
        pastDuePercent: result.pastDuePercent,
        unappliedCreditCents: result.unappliedCreditCents,
        mtdWriteOffsCents: result.mtdWriteOffsCents,
        aging: mapAgingBuckets(result.aging),
      };
    },
  );

  routes.get(
    "/accounting/customer-balances",
    {
      schema: {
        operationId: "listInternalAccountingCustomerBalances",
        tags: ["internal"],
        summary: "List customer AR balances",
        querystring: customerBalancesListQuerySchema,
        response: {
          200: customerBalancesListResponseSchema,
          400: zodValidationErrorResponseSchema,
          401: unauthorizedResponseSchema,
        },
        "x-table": customerBalancesListTable,
      } as FastifySchema & { "x-table": typeof customerBalancesListTable },
    },
    async (request) => {
      const query = request.query as {
        asOf?: string;
        bucket?: z.infer<typeof agingBucketSchema>;
        q?: string;
        page: number;
        pageSize: number;
        sortBy: keyof typeof customerBalanceSortByMap;
        sortOrder: "asc" | "desc";
      };
      const asOf = resolveAsOf(
        query.asOf === undefined ? undefined : new Date(query.asOf),
        new Date(),
      );
      const result = await request.server.accounting.listCustomerBalances.execute({
        organizationId: staffOrganizationId(request),
        asOf,
        bucket: query.bucket,
        q: query.q,
        page: query.page,
        pageSize: query.pageSize,
        sortBy: customerBalanceSortByMap[query.sortBy],
        sortOrder: query.sortOrder,
      });
      return {
        items: result.items.map((row) => ({
          customerId: row.customerId,
          customerNumber: row.customerNumber,
          name: row.name,
          openBalanceCents: row.openBalanceCents,
          pastDueCents: row.pastDueCents,
          oldestDueDate: row.oldestDueDate,
          daysPastDue: row.daysPastDue,
          creditLimitCents: row.creditLimitCents,
          availableCreditCents: row.availableCreditCents,
          hasActivePlan: row.hasActivePlan,
        })),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      };
    },
  );

  routes.get(
    "/accounting/payments",
    {
      schema: {
        operationId: "listInternalAccountingPayments",
        tags: ["internal"],
        summary: "List payments received in a date range",
        querystring: paymentsReceivedListQuerySchema,
        response: {
          200: paymentsReceivedListResponseSchema,
          400: zodValidationErrorResponseSchema,
          401: unauthorizedResponseSchema,
        },
        "x-table": paymentsReceivedListTable,
      } as FastifySchema & { "x-table": typeof paymentsReceivedListTable },
    },
    async (request) => {
      const query = request.query as {
        from: string;
        to: string;
        page: number;
        pageSize: number;
        sortBy: keyof typeof paymentsReceivedSortByMap;
        sortOrder: "asc" | "desc";
      };
      const result = await request.server.accounting.listPaymentsReceived.execute({
        organizationId: staffOrganizationId(request),
        from: new Date(query.from),
        to: new Date(query.to),
        page: query.page,
        pageSize: query.pageSize,
        sortBy: paymentsReceivedSortByMap[query.sortBy],
        sortOrder: query.sortOrder,
      });
      return {
        items: result.items.map((row) => ({
          paymentId: row.paymentId,
          receivedAt: row.receivedAt,
          customerId: row.customerId,
          customerNumber: row.customerNumber,
          customerName: row.customerName,
          amountCents: row.amountCents,
          currency: row.currency,
          method: row.method,
          reference: row.reference,
          note: row.note,
          voidReason: row.voidReason,
          appliedCents: row.appliedCents,
          unappliedCents: row.unappliedCents,
          voided: row.voided,
        })),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      };
    },
  );
}
