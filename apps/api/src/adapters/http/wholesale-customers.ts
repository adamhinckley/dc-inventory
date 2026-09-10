import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { z } from "zod";
import {
  type BillTo,
  type Contact,
  type Customer,
  type ExemptionCertificate,
  type ShipTo,
  ShipToId,
} from "@dc-inventory/customers";
import { StaffUserId, WholesaleUserId } from "@dc-inventory/shared-kernel";
import {
  billToItemSchema,
  contactListResponseSchema,
  exemptionItemSchema,
  exemptionListResponseSchema,
  exemptionWriteBodySchema,
  invalidResponseSchema,
  needsCustomerResponseSchema,
  notFoundResponseSchema,
  shipToItemSchema,
  shipToListResponseSchema,
  shipToPatchBodySchema,
  shipToWriteBodySchema,
  unauthorizedResponseSchema,
  wholesaleCustomerItemSchema,
  wholesaleCustomerNotePatchBodySchema,
  wholesaleAccountDetailSchema,
  wholesaleShipToParamsSchema,
  zodValidationErrorResponseSchema,
} from "../../schemas.js";
import { wholesaleCustomerId, wholesaleOrganizationId } from "./org-session.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

const WHOLESALE_USER_ID_SENTINEL = WholesaleUserId.parse(
  "00000000-0000-4000-8000-000000000000",
);

const STAFF_USER_ID_SENTINEL = StaffUserId.parse("00000000-0000-4000-8000-000000000000");

function wholesaleIdentity(request: {
  wholesaleAuth?: {
    mode: "buyer" | "staff_acting";
    customerId: string | null;
    wholesaleUserId: string | null;
  };
}) {
  return {
    customerId: wholesaleCustomerId(request),
    wholesaleUserId:
      request.wholesaleAuth?.mode === "staff_acting"
        ? WHOLESALE_USER_ID_SENTINEL
        : WholesaleUserId.parse(request.wholesaleAuth?.wholesaleUserId ?? ""),
  };
}

function mapShipTo(shipTo: ShipTo) {
  return {
    id: shipTo.id,
    customerId: shipTo.customerId,
    line1: shipTo.line1,
    line2: shipTo.line2,
    city: shipTo.city,
    region: shipTo.region,
    postal: shipTo.postal,
    country: shipTo.country,
    isDefault: shipTo.isDefault,
  };
}

function mapBillTo(billTo: BillTo) {
  return {
    customerId: billTo.customerId,
    line1: billTo.line1,
    line2: billTo.line2,
    city: billTo.city,
    region: billTo.region,
    postal: billTo.postal,
    country: billTo.country,
  };
}

function mapContact(contact: Contact) {
  return {
    id: contact.id,
    customerId: contact.customerId,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
  };
}

function mapExemption(certificate: ExemptionCertificate) {
  return {
    id: certificate.id,
    customerId: certificate.customerId,
    objectKey: certificate.objectKey,
    jurisdiction: certificate.jurisdiction,
    entityUseCode: certificate.entityUseCode,
    expiresAt: certificate.expiresAt?.toISOString() ?? null,
    status: certificate.status,
  };
}

function mapWholesaleCustomer(customer: Customer) {
  return {
    id: customer.id,
    name: customer.name,
    customerNumber: customer.customerNumber,
    creditLimitCents: customer.creditLimit.amountMinor,
    currency: customer.creditLimit.currency,
    terms: customer.terms,
    taxId: customer.taxId,
    accountStatus: customer.accountStatus,
    customerNote: customer.customerNote,
    createdAt: customer.createdAt.toISOString(),
  };
}

function sendNotFound(reply: FastifyReply) {
  return reply.code(404).send({ error: "not_found" as const });
}

function sendInvalid(reply: FastifyReply) {
  return reply.code(400).send({ error: "invalid" as const });
}

function parseOptionalDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return new Date(value);
}

export function registerWholesaleCustomerRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.get(
    "/account/detail",
    {
      schema: {
        operationId: "getWholesaleAccountDetail",
        tags: ["wholesale"],
        summary: "Read bundled account detail for session customer",
        response: {
          200: wholesaleAccountDetailSchema,
          401: unauthorizedResponseSchema,
          403: needsCustomerResponseSchema,
          404: notFoundResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const identity = wholesaleIdentity(request);
      const result = await request.server.customers.getWholesaleAccountDetail.execute({
        organizationId: wholesaleOrganizationId(request),
        wholesaleUserId: identity.wholesaleUserId,
        customerId: identity.customerId,
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return {
        account: mapWholesaleCustomer(result.account),
        shipTos: result.shipTos.map(mapShipTo),
        billTo: result.billTo === null ? null : mapBillTo(result.billTo),
        contacts: result.contacts.map(mapContact),
        certificates: result.certificates.map(mapExemption),
      };
    },
  );

  routes.get(
    "/account",
    {
      schema: {
        operationId: "getWholesaleAccount",
        tags: ["wholesale"],
        summary: "Read own customer account",
        response: {
          200: wholesaleCustomerItemSchema,
          401: unauthorizedResponseSchema,
          403: needsCustomerResponseSchema,
          404: notFoundResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const identity = wholesaleIdentity(request);
      const result = await request.server.customers.getWholesaleCustomer.execute({
        organizationId: wholesaleOrganizationId(request),
        wholesaleUserId: identity.wholesaleUserId,
        customerId: identity.customerId,
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return mapWholesaleCustomer(result.customer);
    },
  );

  routes.patch(
    "/account",
    {
      schema: {
        operationId: "updateWholesaleAccountCustomerNote",
        tags: ["wholesale"],
        summary: "Edit own customer note",
        body: wholesaleCustomerNotePatchBodySchema,
        response: {
          200: wholesaleCustomerItemSchema,
          400: z.union([invalidResponseSchema, zodValidationErrorResponseSchema]),
          401: unauthorizedResponseSchema,
          403: needsCustomerResponseSchema,
          404: notFoundResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const identity = wholesaleIdentity(request);
      const result = await request.server.customers.updateWholesaleCustomerNote.execute({
        organizationId: wholesaleOrganizationId(request),
        wholesaleUserId: identity.wholesaleUserId,
        customerId: identity.customerId,
        customerNote: request.body.customerNote,
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return mapWholesaleCustomer(result.customer);
    },
  );

  routes.get(
    "/ship-tos",
    {
      schema: {
        operationId: "listWholesaleShipTos",
        tags: ["wholesale"],
        summary: "List ship-tos for session customer",
        response: {
          200: shipToListResponseSchema,
          401: unauthorizedResponseSchema,
          403: needsCustomerResponseSchema,
          404: notFoundResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const identity = wholesaleIdentity(request);
      const result = await request.server.customers.listShipTos.execute({
        organizationId: wholesaleOrganizationId(request),
        staffUserId: STAFF_USER_ID_SENTINEL,
        customerId: identity.customerId,
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return { items: result.items.map(mapShipTo) };
    },
  );

  routes.post(
    "/ship-tos",
    {
      schema: {
        operationId: "createWholesaleShipTo",
        tags: ["wholesale"],
        summary: "Create ship-to for session customer",
        body: shipToWriteBodySchema,
        response: {
          201: shipToItemSchema,
          400: z.union([invalidResponseSchema, zodValidationErrorResponseSchema]),
          401: unauthorizedResponseSchema,
          403: needsCustomerResponseSchema,
          404: notFoundResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const identity = wholesaleIdentity(request);
      const result = await request.server.customers.createShipTo.execute({
        organizationId: wholesaleOrganizationId(request),
        staffUserId: STAFF_USER_ID_SENTINEL,
        customerId: identity.customerId,
        ...request.body,
      });
      if (!result.ok) {
        return result.reason === "not_found" ? sendNotFound(reply) : sendInvalid(reply);
      }
      return reply.code(201).send(mapShipTo(result.shipTo));
    },
  );

  routes.patch(
    "/ship-tos/:shipToId",
    {
      schema: {
        operationId: "updateWholesaleShipTo",
        tags: ["wholesale"],
        summary: "Update ship-to for session customer",
        params: wholesaleShipToParamsSchema,
        body: shipToPatchBodySchema,
        response: {
          200: shipToItemSchema,
          400: z.union([invalidResponseSchema, zodValidationErrorResponseSchema]),
          401: unauthorizedResponseSchema,
          403: needsCustomerResponseSchema,
          404: notFoundResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const identity = wholesaleIdentity(request);
      const result = await request.server.customers.updateShipTo.execute({
        organizationId: wholesaleOrganizationId(request),
        staffUserId: STAFF_USER_ID_SENTINEL,
        customerId: identity.customerId,
        shipToId: ShipToId.parse(request.params.shipToId),
        ...request.body,
      });
      if (!result.ok) {
        return result.reason === "not_found" ? sendNotFound(reply) : sendInvalid(reply);
      }
      return mapShipTo(result.shipTo);
    },
  );

  routes.get(
    "/contacts",
    {
      schema: {
        operationId: "listWholesaleContacts",
        tags: ["wholesale"],
        summary: "List contacts for session customer",
        response: {
          200: contactListResponseSchema,
          401: unauthorizedResponseSchema,
          403: needsCustomerResponseSchema,
          404: notFoundResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const identity = wholesaleIdentity(request);
      const result = await request.server.customers.listContacts.execute({
        organizationId: wholesaleOrganizationId(request),
        staffUserId: STAFF_USER_ID_SENTINEL,
        customerId: identity.customerId,
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return { items: result.items.map(mapContact) };
    },
  );

  routes.get(
    "/bill-to",
    {
      schema: {
        operationId: "getWholesaleBillTo",
        tags: ["wholesale"],
        summary: "Get bill-to for session customer",
        response: {
          200: billToItemSchema,
          401: unauthorizedResponseSchema,
          403: needsCustomerResponseSchema,
          404: notFoundResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const identity = wholesaleIdentity(request);
      const result = await request.server.customers.getBillTo.execute({
        organizationId: wholesaleOrganizationId(request),
        staffUserId: STAFF_USER_ID_SENTINEL,
        customerId: identity.customerId,
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return mapBillTo(result.billTo);
    },
  );

  routes.get(
    "/exemption-certificates",
    {
      schema: {
        operationId: "listWholesaleExemptionCertificates",
        tags: ["wholesale"],
        summary: "List exemption-certificate metadata for session customer",
        response: {
          200: exemptionListResponseSchema,
          401: unauthorizedResponseSchema,
          403: needsCustomerResponseSchema,
          404: notFoundResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const identity = wholesaleIdentity(request);
      const result = await request.server.customers.listExemptionCertificates.execute({
        organizationId: wholesaleOrganizationId(request),
        staffUserId: STAFF_USER_ID_SENTINEL,
        customerId: identity.customerId,
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return { items: result.items.map(mapExemption) };
    },
  );

  routes.post(
    "/exemption-certificates",
    {
      schema: {
        operationId: "createWholesaleExemptionCertificate",
        tags: ["wholesale"],
        summary: "Create exemption-certificate metadata for session customer",
        body: exemptionWriteBodySchema,
        response: {
          201: exemptionItemSchema,
          400: z.union([invalidResponseSchema, zodValidationErrorResponseSchema]),
          401: unauthorizedResponseSchema,
          403: needsCustomerResponseSchema,
          404: notFoundResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const identity = wholesaleIdentity(request);
      const result = await request.server.customers.createExemptionCertificate.execute({
        organizationId: wholesaleOrganizationId(request),
        staffUserId: STAFF_USER_ID_SENTINEL,
        customerId: identity.customerId,
        jurisdiction: request.body.jurisdiction,
        status: request.body.status,
        entityUseCode: request.body.entityUseCode,
        objectKey: request.body.objectKey,
        expiresAt: parseOptionalDate(request.body.expiresAt) ?? null,
      });
      if (!result.ok) {
        return result.reason === "not_found" ? sendNotFound(reply) : sendInvalid(reply);
      }
      return reply.code(201).send(mapExemption(result.certificate));
    },
  );
}
