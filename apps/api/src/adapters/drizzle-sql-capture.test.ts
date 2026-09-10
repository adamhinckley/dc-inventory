import { invoices } from "@dc-inventory/accounting/schema";
import { CustomerId } from "@dc-inventory/shared-kernel";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { describe, expect, it } from "vitest";
import {
  assertCustomerScopedInvoiceQuery,
  referencesAccountingTable,
} from "./drizzle-sql-capture.js";

describe("drizzle SQL capture helpers", () => {
  const customerId = CustomerId.parse("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  const organizationId = "DEFAULT";

  it("matches Drizzle toSQL invoice selects with quoted identifiers", () => {
    const { sql } = drizzle({} as never)
      .select()
      .from(invoices)
      .where(
        and(eq(invoices.organizationId, organizationId), eq(invoices.customerId, customerId)),
      )
      .toSQL();

    expect(referencesAccountingTable(sql, "invoices")).toBe(true);
    expect(referencesAccountingTable(`select "id" from "accounting"."payments"`, "payments")).toBe(
      true,
    );
    expect(referencesAccountingTable(sql, "payments")).toBe(false);
    assertCustomerScopedInvoiceQuery(
      { text: sql, parameters: [organizationId, customerId] },
      customerId,
    );
  });

  it("rejects org-wide invoice selects without customer_id bind", () => {
    const { sql } = drizzle({} as never)
      .select()
      .from(invoices)
      .where(eq(invoices.organizationId, organizationId))
      .toSQL();

    expect(() =>
      assertCustomerScopedInvoiceQuery({ text: sql, parameters: [organizationId] }, customerId),
    ).toThrow(/customer_id bind/i);
  });
});
