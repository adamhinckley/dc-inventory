/**
 * Customers tables live in `@dc-inventory/customers`. Re-export for leftover
 * local imports; the Kit barrel should import the package `./schema` entry.
 */
export {
  contacts,
  customers,
  customersSchema,
  exemptionCertificates,
  shipTos,
} from "@dc-inventory/customers/schema";
