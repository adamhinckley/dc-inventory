import {
  AGING_BUCKETS,
  computeAvailableCreditCents,
  computeExposureCents,
  type AgingBucket,
  type CustomerBalanceRow,
  type CustomerBalancesListQuery,
  type CustomerBalancesSortBy,
  type OrgSummaryAggregates,
} from "@dc-inventory/accounting";
import { CustomerId } from "@dc-inventory/shared-kernel";
import type { OrganizationId } from "@dc-inventory/shared-kernel";
import { sql, type SQL } from "drizzle-orm";
import type { AppDrizzle } from "../infrastructure/db.js";

type ArSqlScope = {
  readonly organizationId: OrganizationId;
  readonly asOf: Date;
};

function customerBalancesCte(organizationId: OrganizationId, asOf: Date): SQL {
  return sql`
    with invoice_totals as (
      select
        customer_id,
        coalesce(sum(case when remaining_cents > 0 then remaining_cents else 0 end), 0)::int as sum_remaining_cents,
        coalesce(sum(case when remaining_cents > 0 and days_past_due > 0 then remaining_cents else 0 end), 0)::int as past_due_cents,
        min(case when remaining_cents > 0 and days_past_due > 0 then due_date end) as oldest_due_date,
        coalesce(sum(case when remaining_cents > 0 and days_past_due <= 0 then remaining_cents else 0 end), 0)::int as aging_current,
        coalesce(sum(case when remaining_cents > 0 and days_past_due between 1 and 15 then remaining_cents else 0 end), 0)::int as aging_1_15,
        coalesce(sum(case when remaining_cents > 0 and days_past_due between 16 and 30 then remaining_cents else 0 end), 0)::int as aging_16_30,
        coalesce(sum(case when remaining_cents > 0 and days_past_due between 31 and 45 then remaining_cents else 0 end), 0)::int as aging_31_45,
        coalesce(sum(case when remaining_cents > 0 and days_past_due between 46 and 60 then remaining_cents else 0 end), 0)::int as aging_46_60,
        coalesce(sum(case when remaining_cents > 0 and days_past_due between 61 and 90 then remaining_cents else 0 end), 0)::int as aging_61_90,
        coalesce(sum(case when remaining_cents > 0 and days_past_due > 90 then remaining_cents else 0 end), 0)::int as aging_90_plus
      from (
        select
          i.customer_id,
          i.due_date,
          greatest(0, (
            extract(epoch from (
              date_trunc('day', ${asOf} at time zone 'UTC') -
              date_trunc('day', i.due_date at time zone 'UTC')
            )) / 86400
          )::int) as days_past_due,
          (
            i.total_cents - coalesce(applied.applied_cents, 0) - coalesce(adjusted.adjustment_cents, 0)
          )::int as remaining_cents
        from accounting.invoices i
        left join (
          select
            pa.invoice_id,
            sum(pa.amount_cents)::int as applied_cents
          from accounting.payment_applications pa
          inner join accounting.payments p on p.id = pa.payment_id
          where p.organization_id = ${organizationId}
            and p.voided_at is null
            and p.received_at <= ${asOf}
          group by pa.invoice_id
        ) applied on applied.invoice_id = i.id
        left join (
          select
            ia.invoice_id,
            sum(ia.amount_cents)::int as adjustment_cents
          from accounting.invoice_adjustments ia
          where ia.organization_id = ${organizationId}
            and ia.created_at <= ${asOf}
          group by ia.invoice_id
        ) adjusted on adjusted.invoice_id = i.id
        where i.organization_id = ${organizationId}
          and i.posted_at is not null
          and i.posted_at <= ${asOf}
      ) invoice_rows
      group by customer_id
    ),
    payment_totals as (
      select
        p.customer_id,
        coalesce(sum(
          case
            when p.voided_at is null and p.received_at <= ${asOf}
              then p.amount_cents - coalesce(applied.applied_cents, 0)
            else 0
          end
        ), 0)::int as unapplied_credit_cents
      from accounting.payments p
      left join (
        select
          pa.payment_id,
          sum(pa.amount_cents)::int as applied_cents
        from accounting.payment_applications pa
        group by pa.payment_id
      ) applied on applied.payment_id = p.id
      where p.organization_id = ${organizationId}
      group by p.customer_id
    ),
    exposure_totals as (
      select
        o.customer_id,
        coalesce(sum((ol.qty * ol.unit_price_cents)::bigint), 0)::int as confirmed_unshipped_cents
      from sales.orders o
      inner join sales.order_lines ol on ol.order_id = o.id
      where o.organization_id = ${organizationId}
        and o.status = 'confirmed'
      group by o.customer_id
    ),
    active_plans as (
      select distinct pp.customer_id
      from accounting.payment_plans pp
      where pp.organization_id = ${organizationId}
        and pp.ended_at is null
    ),
    customer_balances as (
      select
        c.id as customer_id,
        c.customer_number,
        c.name,
        c.credit_limit_cents,
        coalesce(invoice_totals.sum_remaining_cents, 0) as sum_remaining_cents,
        coalesce(invoice_totals.past_due_cents, 0) as past_due_cents,
        invoice_totals.oldest_due_date,
        coalesce(invoice_totals.aging_current, 0) as aging_current,
        coalesce(invoice_totals.aging_1_15, 0) as aging_1_15,
        coalesce(invoice_totals.aging_16_30, 0) as aging_16_30,
        coalesce(invoice_totals.aging_31_45, 0) as aging_31_45,
        coalesce(invoice_totals.aging_46_60, 0) as aging_46_60,
        coalesce(invoice_totals.aging_61_90, 0) as aging_61_90,
        coalesce(invoice_totals.aging_90_plus, 0) as aging_90_plus,
        coalesce(payment_totals.unapplied_credit_cents, 0) as unapplied_credit_cents,
        coalesce(exposure_totals.confirmed_unshipped_cents, 0) as confirmed_unshipped_cents,
        (active_plans.customer_id is not null) as has_active_plan
      from customers.customers c
      left join invoice_totals on invoice_totals.customer_id = c.id
      left join payment_totals on payment_totals.customer_id = c.id
      left join exposure_totals on exposure_totals.customer_id = c.id
      left join active_plans on active_plans.customer_id = c.id
      where c.organization_id = ${organizationId}
        and (
          coalesce(invoice_totals.sum_remaining_cents, 0) - coalesce(payment_totals.unapplied_credit_cents, 0) > 0
          or coalesce(payment_totals.unapplied_credit_cents, 0) > 0
        )
    )
  `;
}

function bucketColumnName(bucket: AgingBucket): string {
  switch (bucket) {
    case "current":
      return "aging_current";
    case "1-15":
      return "aging_1_15";
    case "16-30":
      return "aging_16_30";
    case "31-45":
      return "aging_31_45";
    case "46-60":
      return "aging_46_60";
    case "61-90":
      return "aging_61_90";
    case "90+":
      return "aging_90_plus";
  }
}

function sortExpression(sortBy: CustomerBalancesSortBy, asOf: Date): SQL {
  switch (sortBy) {
    case "pastDue":
      return sql`past_due_cents`;
    case "openBalance":
      return sql`sum_remaining_cents - unapplied_credit_cents`;
    case "name":
      return sql`name`;
    case "customerNumber":
      return sql`customer_number`;
    case "oldestDue":
      return sql`oldest_due_date`;
    case "daysPastDue":
      return sql`case
        when oldest_due_date is null then 0
        else greatest(0, (
          extract(epoch from (
            date_trunc('day', ${asOf} at time zone 'UTC') -
            date_trunc('day', oldest_due_date at time zone 'UTC')
          )) / 86400
        )::int)
      end`;
    case "creditLimit":
      return sql`credit_limit_cents`;
    case "availableCredit":
      return sql`credit_limit_cents - (sum_remaining_cents + confirmed_unshipped_cents - unapplied_credit_cents)`;
    default:
      return sql`customer_id`;
  }
}

function balancesFilterSql(query: CustomerBalancesListQuery): SQL {
  const filters: SQL[] = [];
  if (query.q !== undefined && query.q.trim().length > 0) {
    const needle = `%${query.q.trim()}%`;
    filters.push(sql`(name ilike ${needle} or customer_number ilike ${needle})`);
  }
  if (query.bucket !== undefined) {
    filters.push(sql.raw(`${bucketColumnName(query.bucket)} > 0`));
  }
  if (filters.length === 0) {
    return sql`true`;
  }
  return sql.join(filters, sql` and `);
}

type BalanceSqlRow = {
  customer_id: string;
  customer_number: string;
  name: string;
  credit_limit_cents: number;
  sum_remaining_cents: number;
  past_due_cents: number;
  oldest_due_date: Date | null;
  unapplied_credit_cents: number;
  confirmed_unshipped_cents: number;
  has_active_plan: boolean;
};

function rowsFromExecute<T>(result: T[] | { rows: T[] }): T[] {
  return Array.isArray(result) ? result : result.rows;
}

function mapBalanceRow(row: BalanceSqlRow, asOf: Date): CustomerBalanceRow {
  const exposureCents = computeExposureCents(
    row.sum_remaining_cents,
    row.confirmed_unshipped_cents,
    row.unapplied_credit_cents,
  );
  let daysPastDue = 0;
  if (row.oldest_due_date !== null) {
    const dueDay = Date.UTC(
      row.oldest_due_date.getUTCFullYear(),
      row.oldest_due_date.getUTCMonth(),
      row.oldest_due_date.getUTCDate(),
    );
    const asOfDay = Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate());
    daysPastDue = Math.max(0, Math.floor((asOfDay - dueDay) / (24 * 60 * 60 * 1000)));
  }
  return {
    customerId: CustomerId.parse(row.customer_id),
    customerNumber: row.customer_number,
    name: row.name,
    openBalanceCents: row.sum_remaining_cents - row.unapplied_credit_cents,
    pastDueCents: row.past_due_cents,
    oldestDueDate: row.oldest_due_date,
    daysPastDue,
    creditLimitCents: row.credit_limit_cents,
    availableCreditCents: computeAvailableCreditCents(row.credit_limit_cents, exposureCents),
    hasActivePlan: row.has_active_plan,
  };
}

export async function queryCustomerBalancesPage(
  db: AppDrizzle,
  query: CustomerBalancesListQuery,
): Promise<{ items: CustomerBalanceRow[]; total: number }> {
  const filter = balancesFilterSql(query);
  const offset = (query.page - 1) * query.pageSize;
  const sortDirection = query.sortOrder === "asc" ? sql`asc` : sql`desc`;

  const countResult = await db.execute<{ total: number }>(sql`
    ${customerBalancesCte(query.organizationId, query.asOf)}
    select count(*)::int as total
    from customer_balances
    where ${filter}
  `);

  const pageResult = await db.execute<BalanceSqlRow>(sql`
    ${customerBalancesCte(query.organizationId, query.asOf)}
    select
      customer_id,
      customer_number,
      name,
      credit_limit_cents,
      sum_remaining_cents,
      past_due_cents,
      oldest_due_date,
      unapplied_credit_cents,
      confirmed_unshipped_cents,
      has_active_plan
    from customer_balances
    where ${filter}
    order by ${sortExpression(query.sortBy, query.asOf)} ${sortDirection}, customer_id asc
    limit ${query.pageSize}
    offset ${offset}
  `);

  return {
    items: rowsFromExecute(pageResult).map((row) => mapBalanceRow(row, query.asOf)),
    total: Number(rowsFromExecute(countResult)[0]?.total ?? 0),
  };
}

export async function queryOrgSummaryAggregates(
  db: AppDrizzle,
  scope: ArSqlScope,
): Promise<OrgSummaryAggregates> {
  const [summaryResult, writeOffResult] = await Promise.all([
    db.execute<{
      total_open_ar_cents: number;
      past_due_cents: number;
      unapplied_credit_cents: number;
      aging_current: number;
      aging_1_15: number;
      aging_16_30: number;
      aging_31_45: number;
      aging_46_60: number;
      aging_61_90: number;
      aging_90_plus: number;
    }>(sql`
      ${customerBalancesCte(scope.organizationId, scope.asOf)}
      select
        coalesce(sum(sum_remaining_cents), 0)::int as total_open_ar_cents,
        coalesce(sum(past_due_cents), 0)::int as past_due_cents,
        coalesce(sum(unapplied_credit_cents), 0)::int as unapplied_credit_cents,
        coalesce(sum(aging_current), 0)::int as aging_current,
        coalesce(sum(aging_1_15), 0)::int as aging_1_15,
        coalesce(sum(aging_16_30), 0)::int as aging_16_30,
        coalesce(sum(aging_31_45), 0)::int as aging_31_45,
        coalesce(sum(aging_46_60), 0)::int as aging_46_60,
        coalesce(sum(aging_61_90), 0)::int as aging_61_90,
        coalesce(sum(aging_90_plus), 0)::int as aging_90_plus
      from customer_balances
    `),
    db.execute<{ mtd_write_offs_cents: number }>(sql`
      select coalesce(sum(amount_cents), 0)::int as mtd_write_offs_cents
      from accounting.invoice_adjustments
      where organization_id = ${scope.organizationId}
        and kind = 'write_off'
        and amount_cents > 0
        and created_at >= date_trunc('month', ${scope.asOf} at time zone 'UTC')
        and created_at <= ${scope.asOf}
    `),
  ]);

  const summaryRow = rowsFromExecute(summaryResult)[0];
  const writeOffRow = rowsFromExecute(writeOffResult)[0];

  const aging: Record<AgingBucket, number> = {
    current: Number(summaryRow?.aging_current ?? 0),
    "1-15": Number(summaryRow?.aging_1_15 ?? 0),
    "16-30": Number(summaryRow?.aging_16_30 ?? 0),
    "31-45": Number(summaryRow?.aging_31_45 ?? 0),
    "46-60": Number(summaryRow?.aging_46_60 ?? 0),
    "61-90": Number(summaryRow?.aging_61_90 ?? 0),
    "90+": Number(summaryRow?.aging_90_plus ?? 0),
  };
  for (const bucket of AGING_BUCKETS) {
    aging[bucket] = Number(aging[bucket]);
  }

  return {
    totalOpenArCents: Number(summaryRow?.total_open_ar_cents ?? 0),
    pastDueCents: Number(summaryRow?.past_due_cents ?? 0),
    unappliedCreditCents: Number(summaryRow?.unapplied_credit_cents ?? 0),
    mtdWriteOffsCents: Number(writeOffRow?.mtd_write_offs_cents ?? 0),
    aging,
  };
}
