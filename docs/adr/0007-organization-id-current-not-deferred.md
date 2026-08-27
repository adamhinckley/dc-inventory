# OrganizationId is current, not deferred

Status: Accepted
Date: 2026-08-27

## Context

Wholesale inventory must support more than one **company** on the same deploy without rewriting the ledger or standing up a database per tenant. v1 demo and `pnpm seed:demo` stay on one implicit org (`OrganizationId.DEFAULT`). The seam is **in progress** so SKU, email, and document numbers do not freeze as globally unique.

Earlier docs listed a second Organization under “explicitly deferred” and parked multi-org under `future-concepts/` as “do not implement.” That blocked agents from landing composite uniqueness and session overwrite while the demo still runs single-org.

## Decision

1. **One Fastify, one Postgres.** Every business aggregate **must carry** `organization_id text not null default 'DEFAULT'` (migration in progress on ADA-157 children). Isolation is application-layer: repositories and HTTP handlers take org from the session, never from an unauthenticated client body (same overwrite rule as wholesale `customerId`).
2. **`OrganizationId` in the shared kernel.** Same pattern as `LocationId`: `DEFAULT` or a UUID. Composite unique constraints — e.g. `(organization_id, sku)`, `(organization_id, email)` for staff and wholesale users.
3. **Not database-per-company.** Login cannot pick a connection string per tenant without a shared directory and N migration/backup surfaces. Subdomains are optional URL sugar; they are not the isolation model.
4. **RLS is not the gate.** Postgres row-level security may be defense-in-depth later; it is not the primary multi-org boundary (same stance as [`stack.md`](../stack.md)).
5. **`TenantId` is 1:1 with `OrganizationId`.** Licensing keeps the name `TenantId`; values are the same string. Do not alias the types away in code — two ubiquitous languages, one grain.
6. **Signup is a later milestone.** `RegisterOrganization`, org slug on login when a second org exists, and shop hostname routing are separate packets on the [Multi-organization](https://linear.app/adamhinckley/project/multi-organization-c54d6b9bb02b) project. The seam and isolation tests land first.
7. **Demo seed stays single-org.** `pnpm seed:demo` writes only `OrganizationId.DEFAULT`. Do not seed a second demo company on these tickets.

## Consequences

- Agents read [`future-concepts/multi-organization.md`](../future-concepts/multi-organization.md) for language and isolation rules; it is the contract note, not a “forbidden” list.
- [`architecture.md`](../architecture.md) §14 no longer defers the `OrganizationId` seam; self-serve signup UI remains out of v1 demo scope until its packet opens.
- New schema and ports must accept `organizationId` and use composite uniqueness. Missing `WHERE organization_id = …` is a failed ticket.
- [`invariants.md`](../invariants.md) G14 and [`licensing.md`](../licensing.md) §1 align on `TenantId` / `OrganizationId` grain.

Related: [Multi-organization implementation map (ADA-157)](https://linear.app/adamhinckley/issue/ADA-157/multi-organization-implementation-map).
