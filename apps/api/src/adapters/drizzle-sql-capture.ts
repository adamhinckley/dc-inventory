import type { CustomerId } from "@dc-inventory/shared-kernel";

export type CapturedQuery = {
  text: string;
  parameters: unknown[];
};

export function stripSqlQuotes(query: string): string {
  return query.replace(/"/g, "");
}

export function normalizeSql(query: string): string {
  return stripSqlQuotes(query).toLowerCase();
}

export function referencesAccountingTable(query: string, table: "invoices" | "payments"): boolean {
  const normalized = normalizeSql(query);
  return new RegExp(`\\bfrom\\s+accounting\\.${table}\\b`).test(normalized);
}

export function referencesSalesTable(query: string, table: "orders" | "order_lines"): boolean {
  const normalized = normalizeSql(query);
  return new RegExp(`\\bfrom\\s+sales\\.${table}\\b`).test(normalized);
}

export function isArBalancesBusinessQuery(query: string): boolean {
  const normalized = normalizeSql(query);
  return (
    normalized.includes("customer_balances") ||
    referencesAccountingTable(query, "invoices") ||
    referencesAccountingTable(query, "payments") ||
    referencesSalesTable(query, "orders") ||
    /invoice_adjustments|payment_plans|payment_applications/.test(normalized)
  );
}

export function invoiceWhereClause(query: string): string {
  const whereIndex = query.search(/\bwhere\b/i);
  return whereIndex < 0 ? "" : query.slice(whereIndex);
}

export function capturePostgresQuery(
  query: unknown,
  parameters: unknown,
): CapturedQuery {
  const text = typeof query === "string" ? query : String(query);
  const params =
    parameters == null
      ? []
      : Array.isArray(parameters)
        ? [...parameters]
        : [...(parameters as Iterable<unknown>)];
  return { text, parameters: params };
}

export function assertCustomerScopedInvoiceQuery(
  entry: CapturedQuery,
  customerId: CustomerId,
): void {
  if (!referencesAccountingTable(entry.text, "invoices")) {
    throw new Error(`expected invoice select query, got: ${entry.text}`);
  }

  const where = invoiceWhereClause(entry.text);
  const normalizedWhere = normalizeSql(where);
  if (where.length === 0) {
    throw new Error(`expected invoice query to include WHERE, got: ${entry.text}`);
  }
  if (!/customer_id\s*=\s*\$/.test(normalizedWhere)) {
    throw new Error(`expected customer_id bind in WHERE, got: ${where}`);
  }
  if (/organization_id\s*=\s*\$\d+\s*;?\s*$/.test(normalizedWhere)) {
    throw new Error(`expected customer-scoped WHERE, got org-only filter: ${where}`);
  }
  if (!entry.parameters.map(String).includes(String(customerId))) {
    throw new Error(
      `expected customerId parameter ${String(customerId)}, got: ${entry.parameters.map(String).join(", ")}`,
    );
  }
}
