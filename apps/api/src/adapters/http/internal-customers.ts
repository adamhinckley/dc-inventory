import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  CustomerId,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import {
  ContactId,
  ExemptionCertificateId,
  ShipToId,
  type Contact,
  type Customer,
  type ExemptionCertificate,
  type ShipTo,
} from "@dc-inventory/customers";
import {
  contactItemSchema,
  contactListResponseSchema,
  contactParamsSchema,
  contactPatchBodySchema,
  contactWriteBodySchema,
  customerIdParamsSchema,
  customerItemSchema,
  customerListQuerySchema,
  customerListResponseSchema,
  customerPatchBodySchema,
  customerWriteBodySchema,
  duplicateEmailResponseSchema,
  exemptionItemSchema,
  exemptionListResponseSchema,
  exemptionParamsSchema,
  exemptionPatchBodySchema,
  exemptionWriteBodySchema,
  invalidResponseSchema,
  notFoundResponseSchema,
  shipToItemSchema,
  shipToListResponseSchema,
  shipToParamsSchema,
  shipToPatchBodySchema,
  shipToWriteBodySchema,
  unauthorizedResponseSchema,
} from "../../schemas.js";
import { staffOrganizationId } from "./org-session.js";

function typed(app: FastifyInstance) {
  return app.withTypeProvider<ZodTypeProvider>();
}

function staffUserId(request: { staffAuth?: { staffUserId: string } }): StaffUserId {
  return StaffUserId.parse(request.staffAuth?.staffUserId ?? "");
}

function mapCustomer(customer: Customer) {
  return {
    id: customer.id,
    name: customer.name,
    creditLimitCents: customer.creditLimit.amountMinor,
    currency: customer.creditLimit.currency,
    terms: customer.terms,
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

function sendNotFound(reply: FastifyReply) {
  return reply.code(404).send({ error: "not_found" as const });
}

function sendInvalid(reply: FastifyReply) {
  return reply.code(400).send({ error: "invalid" as const });
}

function sendDuplicate(reply: FastifyReply) {
  return reply.code(409).send({ error: "duplicate_email" as const });
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

const errorResponses = {
  401: unauthorizedResponseSchema,
  404: notFoundResponseSchema,
  400: invalidResponseSchema,
};

export function registerInternalCustomerRoutes(app: FastifyInstance): void {
  const routes = typed(app);

  routes.get(
    "/customers",
    {
      schema: {
        operationId: "listInternalCustomers",
        tags: ["internal-customers"],
        summary: "List customers",
        querystring: customerListQuerySchema,
        response: { 200: customerListResponseSchema, 401: unauthorizedResponseSchema },
      },
    },
    async (request) => {
      const result = await request.server.customers.listCustomers.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        q: request.query.q,
        page: request.query.page,
        pageSize: request.query.pageSize,
        sortBy: request.query.sortBy,
        sortOrder: request.query.sortOrder,
      });
      return {
        items: result.items.map(mapCustomer),
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
      };
    },
  );

  routes.post(
    "/customers",
    {
      schema: {
        operationId: "createInternalCustomer",
        tags: ["internal-customers"],
        summary: "Create customer",
        body: customerWriteBodySchema,
        response: {
          201: customerItemSchema,
          400: invalidResponseSchema,
          401: unauthorizedResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.customers.createCustomer.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        ...request.body,
      });
      if (!result.ok) {
        return sendInvalid(reply);
      }
      return reply.code(201).send(mapCustomer(result.customer));
    },
  );

  routes.get(
    "/customers/:id",
    {
      schema: {
        operationId: "getInternalCustomer",
        tags: ["internal-customers"],
        summary: "Get customer",
        params: customerIdParamsSchema,
        response: { 200: customerItemSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const result = await request.server.customers.getCustomer.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        customerId: CustomerId.parse(request.params.id),
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return mapCustomer(result.customer);
    },
  );

  routes.patch(
    "/customers/:id",
    {
      schema: {
        operationId: "updateInternalCustomer",
        tags: ["internal-customers"],
        summary: "Update customer",
        params: customerIdParamsSchema,
        body: customerPatchBodySchema,
        response: { 200: customerItemSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const result = await request.server.customers.updateCustomer.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        customerId: CustomerId.parse(request.params.id),
        ...request.body,
      });
      if (!result.ok) {
        return result.reason === "not_found" ? sendNotFound(reply) : sendInvalid(reply);
      }
      return mapCustomer(result.customer);
    },
  );

  routes.get(
    "/customers/:id/contacts",
    {
      schema: {
        operationId: "listInternalCustomerContacts",
        tags: ["internal-customers"],
        summary: "List contacts for a customer",
        params: customerIdParamsSchema,
        response: { 200: contactListResponseSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const result = await request.server.customers.listContacts.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        customerId: CustomerId.parse(request.params.id),
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return { items: result.items.map(mapContact) };
    },
  );

  routes.post(
    "/customers/:id/contacts",
    {
      schema: {
        operationId: "createInternalCustomerContact",
        tags: ["internal-customers"],
        summary: "Create contact",
        params: customerIdParamsSchema,
        body: contactWriteBodySchema,
        response: {
          201: contactItemSchema,
          409: duplicateEmailResponseSchema,
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.customers.createContact.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        customerId: CustomerId.parse(request.params.id),
        ...request.body,
      });
      if (!result.ok) {
        if (result.reason === "duplicate_email") {
          return sendDuplicate(reply);
        }
        return result.reason === "not_found" ? sendNotFound(reply) : sendInvalid(reply);
      }
      return reply.code(201).send(mapContact(result.contact));
    },
  );

  routes.patch(
    "/customers/:id/contacts/:contactId",
    {
      schema: {
        operationId: "updateInternalCustomerContact",
        tags: ["internal-customers"],
        summary: "Update contact",
        params: contactParamsSchema,
        body: contactPatchBodySchema,
        response: {
          200: contactItemSchema,
          409: duplicateEmailResponseSchema,
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.customers.updateContact.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        customerId: CustomerId.parse(request.params.id),
        contactId: ContactId.parse(request.params.contactId),
        ...request.body,
      });
      if (!result.ok) {
        if (result.reason === "duplicate_email") {
          return sendDuplicate(reply);
        }
        return result.reason === "not_found" ? sendNotFound(reply) : sendInvalid(reply);
      }
      return mapContact(result.contact);
    },
  );

  routes.get(
    "/customers/:id/ship-tos",
    {
      schema: {
        operationId: "listInternalCustomerShipTos",
        tags: ["internal-customers"],
        summary: "List ship-tos for a customer",
        params: customerIdParamsSchema,
        response: { 200: shipToListResponseSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const result = await request.server.customers.listShipTos.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        customerId: CustomerId.parse(request.params.id),
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return { items: result.items.map(mapShipTo) };
    },
  );

  routes.post(
    "/customers/:id/ship-tos",
    {
      schema: {
        operationId: "createInternalCustomerShipTo",
        tags: ["internal-customers"],
        summary: "Create ship-to",
        params: customerIdParamsSchema,
        body: shipToWriteBodySchema,
        response: { 201: shipToItemSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const result = await request.server.customers.createShipTo.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        customerId: CustomerId.parse(request.params.id),
        ...request.body,
      });
      if (!result.ok) {
        return result.reason === "not_found" ? sendNotFound(reply) : sendInvalid(reply);
      }
      return reply.code(201).send(mapShipTo(result.shipTo));
    },
  );

  routes.patch(
    "/customers/:id/ship-tos/:shipToId",
    {
      schema: {
        operationId: "updateInternalCustomerShipTo",
        tags: ["internal-customers"],
        summary: "Update ship-to",
        params: shipToParamsSchema,
        body: shipToPatchBodySchema,
        response: { 200: shipToItemSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const result = await request.server.customers.updateShipTo.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        customerId: CustomerId.parse(request.params.id),
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
    "/customers/:id/exemption-certificates",
    {
      schema: {
        operationId: "listInternalCustomerExemptionCertificates",
        tags: ["internal-customers"],
        summary: "List exemption-certificate metadata",
        params: customerIdParamsSchema,
        response: { 200: exemptionListResponseSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const result = await request.server.customers.listExemptionCertificates.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        customerId: CustomerId.parse(request.params.id),
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return { items: result.items.map(mapExemption) };
    },
  );

  routes.post(
    "/customers/:id/exemption-certificates",
    {
      schema: {
        operationId: "createInternalCustomerExemptionCertificate",
        tags: ["internal-customers"],
        summary: "Create exemption-certificate metadata",
        params: customerIdParamsSchema,
        body: exemptionWriteBodySchema,
        response: { 201: exemptionItemSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const result = await request.server.customers.createExemptionCertificate.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        customerId: CustomerId.parse(request.params.id),
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

  routes.patch(
    "/customers/:id/exemption-certificates/:certificateId",
    {
      schema: {
        operationId: "updateInternalCustomerExemptionCertificate",
        tags: ["internal-customers"],
        summary: "Update exemption-certificate metadata",
        params: exemptionParamsSchema,
        body: exemptionPatchBodySchema,
        response: { 200: exemptionItemSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const result = await request.server.customers.updateExemptionCertificate.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        customerId: CustomerId.parse(request.params.id),
        certificateId: ExemptionCertificateId.parse(request.params.certificateId),
        jurisdiction: request.body.jurisdiction,
        status: request.body.status,
        entityUseCode: request.body.entityUseCode,
        objectKey: request.body.objectKey,
        expiresAt: parseOptionalDate(request.body.expiresAt),
      });
      if (!result.ok) {
        return result.reason === "not_found" ? sendNotFound(reply) : sendInvalid(reply);
      }
      return mapExemption(result.certificate);
    },
  );
}
