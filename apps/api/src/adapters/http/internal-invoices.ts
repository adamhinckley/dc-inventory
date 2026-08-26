import type { FastifyInstance, FastifyReply } from "fastify";
import type { FastifySchema } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import { InvoiceId, OrganizationId, StaffUserId } from "@dc-inventory/shared-kernel";
import {
  conflictResponseSchema,
  invoiceIdParamsSchema,
  invoiceItemSchema,
  notFoundResponseSchema,
  overpayResponseSchema,
  recordPaymentBodySchema,
  recordPaymentResponseSchema,
  wrongCurrencyResponseSchema,
  unauthorizedResponseSchema,
  zodValidationErrorResponseSchema,
} from "../../schemas.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

function staffUserId(request: { staffAuth?: { staffUserId: string } }): StaffUserId {
  return StaffUserId.parse(request.staffAuth?.staffUserId ?? "");
}

function staffOrganizationId(request: { staffAuth?: { organizationId: string } }): OrganizationId {
  return OrganizationId.parse(request.staffAuth?.organizationId ?? OrganizationId.DEFAULT);
}

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

const readErrors = {
  401: unauthorizedResponseSchema,
  404: notFoundResponseSchema,
};

export function registerInternalInvoiceRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.get(
    "/invoices/:id",
    {
      schema: {
        operationId: "getInternalInvoice",
        tags: ["internal"],
        summary: "Get invoice by id",
        params: invoiceIdParamsSchema,
        response: {
          200: invoiceItemSchema,
          ...readErrors,
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const result = await request.server.accounting.getInvoice.execute({
        staffUserId: staffUserId(request),
        organizationId: staffOrganizationId(request),
        invoiceId: InvoiceId.parse(params.id),
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return result.invoice;
    },
  );

  routes.post(
    "/invoices/:id/record-payment",
    {
      schema: {
        operationId: "recordInternalInvoicePayment",
        tags: ["internal"],
        summary: "Record a payment applied to an invoice",
        params: invoiceIdParamsSchema,
        body: recordPaymentBodySchema,
        response: {
          200: recordPaymentResponseSchema,
          400: z.union([zodValidationErrorResponseSchema, wrongCurrencyResponseSchema]),
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
          409: conflictResponseSchema.or(overpayResponseSchema),
        },
      } as FastifySchema,
    },
    async (request, reply) => {
      const params = request.params as { id: string };
      const body = request.body as {
        amountCents: number;
        currency: string;
        idempotencyKey: string;
      };
      const result = await request.server.accounting.recordPayment.execute({
        staffUserId: staffUserId(request),
        organizationId: staffOrganizationId(request),
        invoiceId: InvoiceId.parse(params.id),
        amountCents: body.amountCents,
        currency: body.currency,
        idempotencyKey: body.idempotencyKey,
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
      return { remainingCents: result.remainingCents, currency: body.currency };
    },
  );
}
