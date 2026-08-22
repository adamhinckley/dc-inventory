# DC Inventory

Wholesale inventory control for a multi-employee wholesale company: staff dashboard, client shop, and a thin software-licensing ops plane — one modular monolith backend, separate Next.js apps per audience.

## Language

### Products and audiences

**Internal app**:
The staff dashboard (`apps/internal`): tables, reports, charts, and CRUD. Not the wholesale shop.
_Avoid_: Admin app, back office (unless speaking casually), spreadsheet UI as the product name

**Wholesale app**:
The client e-commerce app (`apps/wholesale`): browse, PDP, cart, checkout, order history. Not a `DataTable` product.
_Avoid_: Storefront as a synonym in tickets (prefer Wholesale app), shop admin

**Ops app**:
The licensing control plane UI (`apps/ops`) for the software operator and business owner. Deferred from the scaffold; `/ops` API mount may exist without this UI.
_Avoid_: Operator platform (that is a different repo), admin

**Backend scaffold**:
The monorepo foundation and Fastify composition root: workspace tooling, shared kernel, `/health`, empty audience mounts, OpenAPI export stubs, Orval wiring, Drizzle connected with no business schemas yet. Owns the repo root.
_Avoid_: Boilerplate, MVP backend

**Frontend scaffold**:
One Linear project that stands up both the Internal app and the Wholesale app with App Router structure, routing shells, Tailwind + shadcn-style primitives, shared UI packages, and Storybook — without merging the two apps into one Next.js project.
_Avoid_: UI boilerplate, “the frontend” (when you mean one of the two apps)

### Building blocks

**Shared kernel**:
Cross-context types only: `Money`, `Sku`, and branded IDs. Nothing else.
_Avoid_: Common, utils, core (as a dumping ground)

**DataTable**:
Staff-only list UI in `packages/ui-internal`, driven by OpenAPI `x-table` meta + Orval hooks. Never used as the Wholesale catalog.
_Avoid_: Grid, CRUD table (as the component name)

**Orval client**:
Generated TanStack Query hooks from committed OpenAPI specs. The only allowed way a Next.js app talks to the API.
_Avoid_: Hand-written fetch layer, API SDK (unless you mean these packages)

**Agent-optimized scaffold**:
Repo layout, scripts, tickets, and examples shaped so a coding agent can finish a slice from allowed paths + failing tests without inventing structure. Prefer boring, explicit, duplicated-if-clear over clever shared abstractions.
_Avoid_: “DX”, developer experience (when you mean agent success), flexible folder conventions
