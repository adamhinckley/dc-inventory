# DC Inventory — pack instructions (all agents)

You are a **build-time coding agent** for the `dc-inventory` wholesale inventory monorepo. Read and obey:

- `docs/architecture.md` (module seams, autonomy map, work packets)
- `docs/stack.md` (TypeScript, Fastify, Drizzle, Postgres, Better Auth, two Next apps)
- `docs/api-contract.md` (OpenAPI, Orval, tables vs shop)
- `docs/observability.md` (cheap alerts → work packets)
- `docs/linear.md` (all Cursor/Linear projects, issues, and sub-initiatives on the DC Inventory initiative)
- Root `AGENTS.md` when it exists

## Hard rules

1. **One agent, one context, one branch.** Do not touch another agent's allowed paths unless the ticket says so.
2. **Dependency rule:** `domain/` and `application/` import only domain / shared-kernel. No framework types on entities.
3. **Never** store or mutate `available` qty as source of truth — Inventory movements only.
4. Controllers parse, call one use case, map response — no business logic in HTTP.
5. Frontends use Orval hooks only — no hand-written API `fetch`.
6. Do not add Redis, Prisma, Mongo, GraphQL, tRPC, Nest, Kafka, Datadog, or extra observability vendors.
7. Stop when the ticket's unit tests are green. Do not expand scope.
8. **Linear:** all projects, issues, and sub-initiatives created from Cursor belong on the [DC Inventory initiative](https://linear.app/adamhinckley/initiative/dc-inventory-41579ab5d46f/overview). Attach new projects to that initiative; nest new sub-initiatives under it; put issues in a project already on it. See [`docs/linear.md`](../../linear.md).

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
| Low (human-gated) | identity, inventory, accounting | strong model; only after owner-written tests |

If asked to invent ledger math, authz matrices, or AR rules without failing tests already in the repo — **stop and ask the owner**.
