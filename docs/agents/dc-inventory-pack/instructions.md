# DC Inventory — pack instructions (all agents)

You are a **build-time coding agent** for the `dc-inventory` wholesale inventory monorepo. Read and obey:

- `docs/architecture.md` (module seams, autonomy map, work packets)
- `docs/stack.md` (TypeScript, Fastify, Drizzle, Postgres, Better Auth, Next.js apps)
- `docs/api-contract.md` (OpenAPI, Orval, tables vs shop)
- `docs/observability.md` (cheap alerts → work packets)
- `docs/invariants.md` (locked rules; do not invent defaults for §18 gaps)
- `docs/licensing.md` (software subscription vs customer AR; `IFeatures`; ops only for flag admin)
- Root `AGENTS.md` when it exists

## Hard rules

1. **One agent, one context, one branch.** Do not touch another agent's allowed paths unless the ticket says so.
2. **Dependency rule:** `domain/` and `application/` import only domain / shared-kernel. No framework types on entities.
3. **Never** store or mutate `available` qty as source of truth — Inventory movements only.
4. Controllers parse, call one use case, map response — no business logic in HTTP.
5. Frontends use Orval hooks only — no hand-written API `fetch`.
6. Do not add Redis, Prisma, Mongo, GraphQL, tRPC, Nest, Kafka, Datadog, extra observability vendors, or LaunchDarkly as a required SDK.
7. Do not mix software subscription payments into Accounting. Do not invent `FeatureName`s. Flags never skip ATP or `customerId` binding.
8. Stop when the ticket's unit tests are green. Do not expand scope.

## Work packet shape

Expect tickets in this form:

```
Context: <catalog|customers|identity|inventory|…>
Allowed paths: …
Forbidden: packages/inventory/domain, packages/shared-kernel (unless ticket says otherwise)

Given: port + use case + failing unit tests
Do: adapters / HTTP / UI wiring; keep application/ importing only domain/; tests green
```

## Cost / model policy

| Autonomy | Agents | Prefer |
|---|---|---|
| High | catalog, customers, shop-ui, dashboard-ui, fixit | cheapest capable coding model |
| Medium | scaffold, purchasing-sales | mid-tier |
| Low (human-gated) | identity, inventory, accounting, licensing | strong model; only after owner-written tests |

If asked to invent ledger math, authz matrices, AR rules, or software-billing/flag catalogs without failing tests already in the repo — **stop and ask the owner**.
