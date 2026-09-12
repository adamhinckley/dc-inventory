import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import {
  CustomerId,
  StaffUserId,
} from "@dc-inventory/shared-kernel";
import {
  type Contact,
  type Customer,
  type ExemptionCertificate,
  type BillTo,
  type ShipTo,
} from "@dc-inventory/customers";
import {
  ContactId,
  ExemptionCertificateId,
  ShipToId,
} from "@dc-inventory/customers";
import {
  billToAlreadyExistsResponseSchema,
  billToItemSchema,
  billToPatchBodySchema,
  billToWriteBodySchema,
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
  customersListTable,
  duplicateEmailResponseSchema,
  duplicateCustomerNumberResponseSchema,
  exemptionItemSchema,
  exemptionListResponseSchema,
  exemptionParamsSchema,
  exemptionPatchBodySchema,
  exemptionWriteBodySchema,
  invalidResponseSchema,
  noDefaultShipToResponseSchema,
  notFoundResponseSchema,
  shipToItemSchema,
  shipToListResponseSchema,
  shipToParamsSchema,
  shipToPatchBodySchema,
  shipToWriteBodySchema,
  unauthorizedResponseSchema,
  zodValidationErrorResponseSchema,
} from "../../schemas.js";
import type { FastifySchema } from "fastify";
import { z } from "zod";
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
    customerNumber: customer.customerNumber,
    creditLimitCents: customer.creditLimit.amountMinor,
    currency: customer.creditLimit.currency,
    terms: customer.terms,
    taxId: customer.taxId,
    accountStatus: customer.accountStatus,
    customerNote: customer.customerNote,
    staffNote: customer.staffNote,
    createdAt: customer.createdAt.toISOString(),
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

function sendDuplicateCustomerNumber(reply: FastifyReply) {
  return reply.code(409).send({ error: "duplicate_customer_number" as const });
}

function sendBillToExists(reply: FastifyReply) {
  return reply.code(409).send({ error: "already_exists" as const });
}

function sendNoDefaultShipTo(reply: FastifyReply) {
  return reply.code(400).send({ error: "no_default_ship_to" as const });
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
        response: {
          200: customerListResponseSchema,
          400: zodValidationErrorResponseSchema,
          401: unauthorizedResponseSchema,
        },
        "x-table": customersListTable,
      } as FastifySchema & { "x-table": typeof customersListTable },
    },
    async (request) => {
      const query = request.query as {
        q?: string;
        accountStatus?: "active" | "on_hold" | "inactive";
        page: number;
        pageSize: number;
        sortBy: "name" | "createdAt" | "creditLimitCents" | "customerNumber";
        sortOrder: "asc" | "desc";
      };
      const result = await request.server.customers.listCustomers.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        q: query.q,
        accountStatus: query.accountStatus,
        page: query.page,
        pageSize: query.pageSize,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
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
          409: z.union([
            duplicateCustomerNumberResponseSchema,
            duplicateEmailResponseSchema,
          ]),
        },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const result = await request.server.customers.createCustomer.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        staffRoles: request.staffAuth?.roles ?? [],
        name: body.name,
        terms: body.terms,
        creditLimitCents: body.creditLimitCents,
        currency: body.currency,
        customerNumber: body.customerNumber,
        taxId: body.taxId,
        accountStatus: body.accountStatus,
        customerNote: body.customerNote,
        staffNote: body.staffNote,
        wholesaleEmail: body.wholesaleEmail,
        wholesaleDisplayName: body.wholesaleDisplayName,
      });
      if (!result.ok) {
        if (result.reason === "duplicate_customer_number") {
          return sendDuplicateCustomerNumber(reply);
        }
        if (result.reason === "duplicate_email") {
          return sendDuplicate(reply);
        }
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

  routes.get(
    "/customers/:id/bill-to",
    {
      schema: {
        operationId: "getInternalCustomerBillTo",
        tags: ["internal-customers"],
        summary: "Get bill-to for a customer",
        params: customerIdParamsSchema,
        response: { 200: billToItemSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const result = await request.server.customers.getBillTo.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        customerId: CustomerId.parse(request.params.id),
      });
      if (!result.ok) {
        return sendNotFound(reply);
      }
      return mapBillTo(result.billTo);
    },
  );

  routes.post(
    "/customers/:id/bill-to",
    {
      schema: {
        operationId: "createInternalCustomerBillTo",
        tags: ["internal-customers"],
        summary: "Create bill-to",
        params: customerIdParamsSchema,
        body: billToWriteBodySchema,
        response: {
          201: billToItemSchema,
          409: billToAlreadyExistsResponseSchema,
          ...errorResponses,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.customers.createBillTo.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        customerId: CustomerId.parse(request.params.id),
        ...request.body,
      });
      if (!result.ok) {
        if (result.reason === "already_exists") {
          return sendBillToExists(reply);
        }
        return result.reason === "not_found" ? sendNotFound(reply) : sendInvalid(reply);
      }
      return reply.code(201).send(mapBillTo(result.billTo));
    },
  );

  routes.patch(
    "/customers/:id/bill-to",
    {
      schema: {
        operationId: "updateInternalCustomerBillTo",
        tags: ["internal-customers"],
        summary: "Update bill-to",
        params: customerIdParamsSchema,
        body: billToPatchBodySchema,
        response: { 200: billToItemSchema, ...errorResponses },
      },
    },
    async (request, reply) => {
      const result = await request.server.customers.updateBillTo.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        customerId: CustomerId.parse(request.params.id),
        ...request.body,
      });
      if (!result.ok) {
        return result.reason === "not_found" ? sendNotFound(reply) : sendInvalid(reply);
      }
      return mapBillTo(result.billTo);
    },
  );

  routes.post(
    "/customers/:id/bill-to/copy-from-default-ship-to",
    {
      schema: {
        operationId: "copyInternalCustomerBillToFromDefaultShipTo",
        tags: ["internal-customers"],
        summary: "Copy default ship-to address into bill-to",
        params: customerIdParamsSchema,
        response: {
          200: billToItemSchema,
          400: z.union([invalidResponseSchema, noDefaultShipToResponseSchema]),
          401: unauthorizedResponseSchema,
          404: notFoundResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await request.server.customers.copyBillToFromDefaultShipTo.execute({
        organizationId: staffOrganizationId(request),
        staffUserId: staffUserId(request),
        customerId: CustomerId.parse(request.params.id),
      });
      if (!result.ok) {
        if (result.reason === "no_default_ship_to") {
          return sendNoDefaultShipTo(reply);
        }
        return sendNotFound(reply);
      }
      return mapBillTo(result.billTo);
    },
  );
}
