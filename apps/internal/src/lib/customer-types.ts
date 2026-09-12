import type {
  getInternalCustomer,
  getInternalSession,
  listInternalCustomerContacts,
  listInternalCustomerExemptionCertificates,
  listInternalCustomerShipTos,
} from "@dc-inventory/api-client-internal";

export type CustomerDetail = Extract<
  Awaited<ReturnType<typeof getInternalCustomer>>,
  { status: 200 }
>["data"];

export type CustomerAccountStatus = CustomerDetail["accountStatus"];

export type CustomerShipToRow = Extract<
  Awaited<ReturnType<typeof listInternalCustomerShipTos>>,
  { status: 200 }
>["data"]["items"][number];

export type CustomerContactRow = Extract<
  Awaited<ReturnType<typeof listInternalCustomerContacts>>,
  { status: 200 }
>["data"]["items"][number];

export type CustomerCertificateRow = Extract<
  Awaited<ReturnType<typeof listInternalCustomerExemptionCertificates>>,
  { status: 200 }
>["data"]["items"][number];

export type InternalSession = Extract<
  Awaited<ReturnType<typeof getInternalSession>>,
  { status: 200 }
>["data"];

export type StaffSessionRoles = Extract<InternalSession, { audience: "staff" }>["roles"];

export type StaffSessionRole = StaffSessionRoles[number];

export function staffRolesFromSession(
  session: InternalSession | undefined,
): StaffSessionRoles {
  if (session === undefined || session.audience !== "staff") {
    return [];
  }
  return session.roles;
}
