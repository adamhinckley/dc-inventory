# Auth vendors research (2026-09-10)

Factual notes from **official / first-party docs** for DC Inventory Identity. **No product recommendation.** If a claim is not in those sources, it is marked **unclear**.

**Repo context used (not invented):** TypeScript monorepo, Fastify API + three Next.js apps, Identity as a bounded context, users in our Postgres, server-side cookies (not JWT in `localStorage`), audiences staff / wholesale / ops (ops deferred). Stack already names Better Auth as an Identity **adapter only** and rejects Clerk/Auth0 as source of truth for customers in v1. Custom Identity already exists (`StaffUser`, `WholesaleUser`, `OpsUser`, scrypt hasher, Postgres session store).

Sources for that context: [`docs/stack.md`](../stack.md) §2, §5; [`packages/identity/README.md`](../../packages/identity/README.md); [`packages/identity/src/domain/ports/session-store.ts`](../../packages/identity/src/domain/ports/session-store.ts); [`packages/identity/src/domain/ports/password-hasher.ts`](../../packages/identity/src/domain/ports/password-hasher.ts).

---

## 1. Better Auth (self-hosted library)

Official site: [https://www.better-auth.com/docs](https://www.better-auth.com/docs)

### What it owns

- **Users, sessions, passwords, accounts, verification tokens** in *your* database (core tables `user`, `session`, `account`, `verification`). ([Database](https://www.better-auth.com/docs/concepts/database))
- **Email/password** when `emailAndPassword.enabled` is true; social providers via `socialProviders`. ([Basic usage](https://www.better-auth.com/docs/basic-usage), [Installation](https://www.better-auth.com/docs/installation))
- **Organizations / members / teams / invitations / org RBAC** via the **organization plugin** (not core). ([Organization plugin](https://www.better-auth.com/docs/plugins/organization))
- **Cookie session identifier**, optional `session_data` cookie cache, optional JWT plugin for tokens (separate from the session cookie). ([Session management](https://www.better-auth.com/docs/concepts/session-management), [Cookies](https://www.better-auth.com/docs/concepts/cookies))

It is a **TypeScript library you run in your process** (“Your auth lives in your codebase”). ([Introduction](https://www.better-auth.com/docs/introduction))

### Where data lives

- Postgres (or SQLite/MySQL/etc.) via built-in adapters or **Drizzle adapter** (`drizzleAdapter`). ([Installation](https://www.better-auth.com/docs/installation))
- Table/column names are configurable (`modelName`, `fields`). You can **extend** `user` and `session` with `additionalFields`; you do **not** get first-class multiple user *tables* as separate entity types. ([Database — custom tables / extending schema](https://www.better-auth.com/docs/concepts/database))
- Optional secondary storage (docs mention Redis); stack.md already rejects Redis in v1 — that is a product constraint, not a Better Auth requirement.

### Fastify verifying a Next.js session (different origin)

1. Mount `auth.handler` on Fastify at `/api/auth/*` (or configured base path). ([Fastify integration](https://www.better-auth.com/docs/integrations/fastify))
2. Next.js can also mount `toNextJsHandler(auth)` at `/api/auth/[...all]`. ([Next.js integration](https://www.better-auth.com/docs/integrations/next))
3. Session check: `auth.api.getSession({ headers: fromNodeHeaders(request.headers) })`. Cookie must be on the request. ([Fastify](https://www.better-auth.com/docs/integrations/fastify))
4. Cross-origin: set `trustedOrigins` and CORS `credentials: true`. ([Fastify — trusted origins / CORS](https://www.better-auth.com/docs/integrations/fastify))
5. **Safari ITP:** if the API host is a *different site* than the frontend, third-party cookies can be blocked. Official workarounds: **reverse-proxy** `/api/auth/*` through the frontend origin, or **shared parent domain** + `crossSubDomainCookies`. ([Cookies — Safari / ITP](https://www.better-auth.com/docs/concepts/cookies))
6. Cross-subdomain sharing is opt-in (`advanced.crossSubDomainCookies`). ([Cookies](https://www.better-auth.com/docs/concepts/cookies))

**Unclear from docs:** a single canonical recipe for *three* Next origins (internal / wholesale / ops) plus one Fastify origin without a proxy. Docs cover one client origin + trustedOrigins, or same-site subdomains.

### Multi-audience (staff vs wholesale)

- One `betterAuth` instance = one `user` table + one default cookie prefix (`better-auth` → `better-auth.session_token`). ([Cookies](https://www.better-auth.com/docs/concepts/cookies), [Database](https://www.better-auth.com/docs/concepts/database))
- Cookie **prefix** and **cookie names** are configurable (`cookiePrefix`, `advanced.cookies.session_token.name`). ([Cookies](https://www.better-auth.com/docs/concepts/cookies), [Options](https://www.better-auth.com/docs/reference/options))
- Docs do **not** describe “staff vs wholesale user types” as a first-class feature. Practical mappings that *are* documented:
  - `user.additionalFields` (e.g. a `role` field with `input: false`). ([Database](https://www.better-auth.com/docs/concepts/database))
  - Organization plugin membership + roles. ([Organization](https://www.better-auth.com/docs/plugins/organization))
  - Two **instances** with different `cookiePrefix` / table `modelName` (prefix/name APIs exist; **running two instances is not a documented first-class pattern** — inferred from those knobs).
- Organization plugin: users can belong to orgs, have roles, active org on session. Teams exist on self-hosted plugin. ([Organization](https://www.better-auth.com/docs/plugins/organization))

### Fit with existing Identity ports

| Existing | Fit |
|---|---|
| `IPasswordHasher` (scrypt + `verifyDummy`) | Better Auth owns hashing when email/password is enabled. Domain port would wrap or be unused for BA-managed passwords. Hash algorithm used internally is **not specified** on the pages cited here (stack.md mentions Argon2id/scrypt as product intent). |
| `ISessionStore` (opaque id, audience, `staffUserId` / `wholesaleUserId` / `opsUserId`, `customerId`) | BA session table is `token` + `userId` + expiry/IP/UA — **no audience or customerId columns** unless you add `session.additionalFields`. ([Session management](https://www.better-auth.com/docs/concepts/session-management), [Database](https://www.better-auth.com/docs/concepts/database)) |
| `StaffUser` / `WholesaleUser` / `OpsUser` separate tables | BA expects **one** `user` model (renameable). Mapping three tables onto one `user` table, or keeping domain tables and syncing, is **not documented**. |
| Staff RBAC (`admin`, `purchasing`, …) | Closest documented tools: `additionalFields.role` or organization plugin access control — **not** the existing staff role enum. |
| `customerId` bound at wholesale login | Would be a custom additional field and/or a join after `getSession`; not a built-in claim. |

Identity README currently: “Better Auth is deferred.” ([`packages/identity/README.md`](../../packages/identity/README.md))

### Lock-in / exit

- Library in-repo; data in your Postgres. You can stop importing `better-auth` and keep/migrate tables. Schema is documented so you can read it without the library. ([Database](https://www.better-auth.com/docs/concepts/database))
- Plugins add more tables; CLI `generate`/`migrate` owns schema evolution. ([Database](https://www.better-auth.com/docs/concepts/database))
- License text was **not retrieved** from the GitHub paths tried (`LICENSE` 404, `LICENSE.md` empty). **Unclear:** SPDX license from docs pages alone.

### Pricing

- No hosted MAU price on better-auth.com docs. You pay compute + database you already run.
- Optional paid Better Auth Cloud / support: **not documented** on the pages fetched for this note.

---

## 2. Neon Auth (Managed Better Auth)

Official: [https://neon.com/docs/auth/overview](https://neon.com/docs/auth/overview) (markdown: [overview.md](https://neon.com/docs/auth/overview.md))

**Status:** Beta. Targets GA “this quarter” (as of the roadmap page). ([Roadmap](https://neon.com/docs/auth/roadmap))  
Pinned Better Auth compatibility: **1.4.18**. ([Overview](https://neon.com/docs/auth/overview))

### What it owns

- Managed **REST Auth API** in the same region as the branch. Your app uses `@neondatabase/auth` / `@neondatabase/neon-js`, not a self-hosted `betterAuth()` config for plugins. ([Overview](https://neon.com/docs/auth/overview), [Plugins](https://neon.com/docs/auth/guides/plugins))
- **Users, sessions, OAuth config, organizations** stored in **`neon_auth` schema** in the branch’s database (`neon_auth.user`, `neon_auth.account`, `neon_auth.session`, `neon_auth.verification`; orgs cloned with branches). ([Authentication flow](https://neon.com/docs/auth/authentication-flow), [Branching](https://neon.com/docs/auth/branching-authentication))
- Email/password, Google/GitHub/Vercel OAuth, Email OTP, Admin, JWT, Magic Link, Open API, Phone Number; Organization **partial**. ([Roadmap](https://neon.com/docs/auth/roadmap), [Plugins](https://neon.com/docs/auth/guides/plugins))
- **Anyone can sign up by default**; restricted signups “coming soon.” ([Authentication flow](https://neon.com/docs/auth/authentication-flow))

You do **not** install Better Auth plugins yourself. ([Plugins](https://neon.com/docs/auth/guides/plugins))

### Where data lives

- Your Neon Postgres, schema `neon_auth`, queryable with SQL. Immediate writes, no sync delay. ([Overview](https://neon.com/docs/auth/overview), [Authentication flow](https://neon.com/docs/auth/authentication-flow))
- Default database is typically `neondb`; Auth requires a **read-write** endpoint. Other DBs on the same branch only if you set `database_name` at enable time. ([Branching](https://neon.com/docs/auth/branching-authentication))
- **Branching:** users, sessions, config, OAuth, JWKS, organizations are **copied** onto the child branch; then isolated. Each branch has its **own Auth URL**. Tokens/sessions do **not** work across branches. Browser cookies stay on the production domain, so you must sign in again on preview. ([Branching](https://neon.com/docs/auth/branching-authentication))
- **AWS regions only**; no Azure; no IP Allow / Private Networking. ([Overview](https://neon.com/docs/auth/overview))

### JWTs vs sessions

- Browser primary: **HTTP-only cookie** `__Secure-neonauth.session_token` — **opaque session token, not a JWT**. SameSite=**None**, Secure, HttpOnly. ([Authentication flow](https://neon.com/docs/auth/authentication-flow))
- SDK also fills `session.access_token` JWT (`sub` = `neon_auth.user.id`) for **Data API** / RLS (`auth.user_id()` / `auth.uid()`). ([Authentication flow](https://neon.com/docs/auth/authentication-flow))
- JWT plugin: for microservices, **separate frontend/backend domains**, CLI. Tokens **EdDSA (Ed25519)**, **15-minute** expiry, JWKS at `{NEON_AUTH_URL}/.well-known/jwks.json`. **Custom JWT claims not supported.** Docs say JWTs are **not** a substitute for session cookies in browser apps. ([JWT plugin](https://neon.com/docs/auth/guides/plugins/jwt))
- Cross-origin `authClient.token()` needs `fetchOptions: { credentials: 'include' }`. Same Safari ITP caveats as Better Auth (docs link there). ([JWT plugin](https://neon.com/docs/auth/guides/plugins/jwt))

### Fastify vs Next-only

**Documented frameworks:** Next.js (App Router + `createNeonAuth` + `auth.handler()` proxy route), Vite+React, React Router, TanStack Router. ([Roadmap](https://neon.com/docs/auth/roadmap), [Next.js API methods](https://neon.com/docs/auth/quick-start/nextjs-api-only))

**Explicitly not supported yet:** “Standalone frontend + backend” (example: CRA + separate Node/Express). Reason given: HTTP-only cookies **cannot be securely shared** between frontend and backend on **different domains**. ([Roadmap](https://neon.com/docs/auth/roadmap))

Fastify is **not** in the supported-framework table. Verifying a JWT on any Node service via JWKS **is** documented (jose example). ([JWT](https://neon.com/docs/auth/guides/plugins/jwt))

**Unclear:** whether a Fastify API on a **same-site subdomain** (e.g. `api.example.com` + cookie `Domain=example.com`) is supported before “standalone frontend + backend” ships. Roadmap language is “different domains.” Same-site parent-domain cookies are discussed on Better Auth’s cookie page, which Neon JWT docs link for ITP.

Next.js path: Next app **proxies** Auth (`app/api/auth/[...path]` → `auth.handler()`), cookie secret `NEON_AUTH_COOKIE_SECRET`. ([Next.js quick start](https://neon.com/docs/auth/quick-start/nextjs-api-only))

### Data API coupling

- Data API is a **separate** PostgREST-style product. It validates JWTs (Managed Better Auth or Auth0/Clerk/Firebase/etc.) and applies Postgres RLS. ([Data API overview](https://neon.com/docs/data-api/overview))
- Managed Auth “has native support” for Data API JWT validation. ([Overview](https://neon.com/docs/auth/overview))
- **You can use Auth without enabling Data API.** Docs describe Auth as identity in Postgres + optional Data API. Nothing fetched says Data API is required to create users/sessions.
- Stack already rejects RLS as the **primary** authz mechanism and Next route handlers as the domain API ([`docs/stack.md`](../stack.md) §4–5). That is a product rule, not a Neon Auth requirement.

### Custom StaffUser / WholesaleUser

- Auth users are **`neon_auth.user`** rows. Docs do not describe mapping onto existing `identity.staff_users` / `wholesale_users` / `ops_users`.
- Organization plugin: owner/admin/member only; **no custom roles, no teams, no server hooks** (`beforeCreateOrganization`, etc.). ([Organization](https://neon.com/docs/auth/guides/plugins/organization))
- **Unclear** whether you can point Managed Auth at the existing `identity` schema instead of `neon_auth`, or disable the managed `user` table.

### Multi-audience

- One Auth config **per branch**, one Auth URL, one cookie name `__Secure-neonauth.session_token`. ([Authentication flow](https://neon.com/docs/auth/authentication-flow))
- Two Neon projects / two Auth enables would be **two** managed services (not documented as a first-class “multi-audience” feature).
- Organization plugin is **B2B-tenant** shaped (workspaces on one branch), not “staff app vs shop app.” ([Organization](https://neon.com/docs/auth/guides/plugins/organization))
- Trusted domains / redirect allowlist exist. ([Roadmap platform table](https://neon.com/docs/auth/roadmap))

### Fit with Identity ports

Same structural mismatch as self-hosted Better Auth, plus:

- You **cannot** plug `IPasswordHasher` or `ISessionStore` into the managed service; hashing/sessions happen in Neon’s Auth process writing `neon_auth.*`. ([Authentication flow](https://neon.com/docs/auth/authentication-flow))
- Adapter would be: verify session/JWT → map `neon_auth.user.id` → domain `StaffUser` / `WholesaleUser`. That mapping is **application code**, not documented by Neon.
- `customerId` on session: **not** in published JWT payload examples (id, email, role `authenticated`, ban fields). Custom claims unsupported. ([JWT](https://neon.com/docs/auth/guides/plugins/jwt), [Authentication flow](https://neon.com/docs/auth/authentication-flow))

### Lock-in / exit

- Rows live in **your** Postgres (`neon_auth`). SQL export is possible. ([Authentication flow](https://neon.com/docs/auth/authentication-flow))
- Auth **API**, cookie format, JWKS, and SDK (`@neondatabase/auth`) are Neon-hosted. Self-host Better Auth is the documented alternative when you need unsupported plugins/hooks. ([Overview — when to self-host](https://neon.com/docs/auth/overview))
- Schema compatibility claim: “Exposes the same APIs and schema as Better Auth” appears on Neon API/auth tooling copy ([Neon Auth API intro](https://neon.com/docs/reference/api/auth)); exact table-for-table dump into self-hosted BA **1.4.18 vs current BA** is **unclear**.
- Legacy Stack Auth path still works; migrate guide exists. ([Overview](https://neon.com/docs/auth/overview))

### Pricing (published)

Included in Neon plans by **MAU** (unique user who authenticates at least once in the billing month):

| Plan | Auth MAU |
|---|---|
| Free | Up to 60,000 |
| Launch | Up to 1M |
| Scale | Up to 1M |

Above 1M: request increase. ([Overview — Pricing](https://neon.com/docs/auth/overview))  
This is **in addition to** Neon compute/storage billing ([Neon plans](https://neon.com/docs/introduction/about-billing)).

---

## 3. Clerk

Official: [https://clerk.com/docs](https://clerk.com/docs), [pricing](https://clerk.com/pricing)

### What it owns

- **Users, sessions, passwords, organizations, memberships, roles** in **Clerk’s** Frontend API (FAPI) + Backend API (BAPI). ([How Clerk works](https://clerk.com/docs/guides/how-clerk-works/overview))
- Hybrid auth: long-lived **client token** (`__client` HttpOnly cookie on **FAPI domain**) + **60-second session JWT** in `__session` cookie on **your app domain** (HttpOnly: **No**). Background refresh ~50s. ([How Clerk works](https://clerk.com/docs/guides/how-clerk-works/overview))
- Organizations: multi-tenant B2B (workspaces), Active Organization on the session, default admin/member, custom roles on paid add-on. ([Organizations](https://clerk.com/docs/guides/organizations/overview), [Roles](https://clerk.com/docs/guides/organizations/control-access/roles-and-permissions))

Clerk’s own docs contrast this with “stateful session ID in your DB” and “stateless JWT”; Clerk is the hybrid hosted model. ([How Clerk works](https://clerk.com/docs/guides/how-clerk-works/overview))

### Where data lives

- **Clerk-hosted** user directory (not your Postgres as SoT).
- Optional **eventually consistent** copy in your DB via webhooks (`user.created` / `updated` / `deleted`). Webhooks are **not guaranteed immediate or at all**; Clerk recommends reading claims from the **session token** when you can, and syncing only extra/social data. ([Syncing](https://clerk.com/docs/guides/development/webhooks/syncing), [Webhooks overview](https://clerk.com/docs/guides/development/webhooks/overview))
- Recommended extra-data pattern: store `clerk_id` + your columns; do **not** treat your table as the password/session authority. ([Syncing](https://clerk.com/docs/guides/development/webhooks/syncing))

**Users can stay in our DB as SoT?** Official guidance is the **opposite**: Clerk user table is primary; your DB is a **cache/projection**. Stack.md already rejects Clerk as SoT for customers in v1. ([`docs/stack.md`](../stack.md) rejected table)

### Fastify + Next.js on another origin

- Official **`@clerk/fastify`**: `clerkPlugin()` reads cookies / `Authorization`, verifies session JWT, `getAuth(request)`. ([Fastify quickstart](https://clerk.com/docs/fastify/getting-started/quickstart), [clerkPlugin](https://clerk.com/docs/reference/fastify/clerk-plugin))
- Cross-origin: send session JWT in **`Authorization`**, not only `__session` (cookie is **not** shared across subdomains by default). ([How Clerk works — session token](https://clerk.com/docs/guides/how-clerk-works/overview), [Manual JWT verification](https://clerk.com/docs/guides/sessions/manual-jwt-verification))
- `authenticateRequest()` / `jwtKey` for networkless verify. ([authenticateRequest](https://clerk.com/docs/reference/backend/authenticate-request))
- **Docs warning (as published):** “Fastify is only compatible with Next.js versions 13.4 and below.” ([Fastify quickstart](https://clerk.com/docs/fastify/getting-started/quickstart)) Stack uses Next.js 16. Whether that sentence is stale vs a real SDK constraint is **unclear** from that page alone (no further explanation).

`__session` is a **JWT**, readable by JS (not HttpOnly). That conflicts with stack.md’s “opaque id in cookie / not JWT in localStorage” **spirit** but is still a cookie, not localStorage. ([How Clerk works](https://clerk.com/docs/guides/how-clerk-works/overview), [`docs/stack.md`](../stack.md) §5)

### Multi-audience / B2B vs B2C

- One Clerk **application** holds many Organizations; roles are defined at application level. ([Organizations](https://clerk.com/docs/guides/organizations/overview))
- B2B add-on: MROs, member caps, custom roles, verified domains, enterprise connections. ([Pricing](https://clerk.com/pricing), [Roles](https://clerk.com/docs/guides/organizations/control-access/roles-and-permissions) — custom roles in **production** need B2B Authentication add-on)
- **Unclear** from docs: first-class “two products, two user populations, cookies must never cross” (staff dashboard vs wholesale shop). Closest tools: **two Clerk applications**, or Organizations + authorization checks. Satellite domains are a paid Pro feature. ([Pricing](https://clerk.com/pricing))

### Fit with Identity ports

| Port / entity | Fit |
|---|---|
| `IPasswordHasher` | Clerk hashes; port unused for login. |
| `ISessionStore` | Sessions live at Clerk; Fastify verifies JWT, does not insert `identity.sessions`. Instant revoke is Clerk-side (hybrid), not your `delete(sessionId)`. |
| `StaffUser` / `WholesaleUser` | Would be webhook-synced rows keyed by `clerk_id`, or abandoned as credential stores. |
| `customerId` | Custom session claims / metadata (&lt;1.2KB in token) or your DB lookup after `userId`. ([Syncing](https://clerk.com/docs/guides/development/webhooks/syncing)) |

### Lock-in / exit

- Full data **export** from Dashboard (Hobby+). ([Pricing FAQ](https://clerk.com/pricing))
- Migration assistance listed under **Enterprise**. ([Pricing](https://clerk.com/pricing))
- After exit you must re-hash or force password reset unless you exported hashes (export contents **not detailed** on the pages fetched).

### Pricing (published, 2026-09-10)

| Plan | Price | Users |
|---|---|---|
| Hobby | $0 | 50,000 **MRU** limit per app |
| Pro | $25/mo ($20/mo annual) | 50k MRU included, then from $0.02/MRU |
| Business | $300/mo ($250/mo annual) | same MRU overage |
| Enterprise | Custom | Custom |

- **MRU** ≠ MAU: counts only if the user returns **≥24h after signup**. ([Pricing FAQ](https://clerk.com/pricing))
- Hobby session lifetime **fixed 7 days**; custom lifetime on Pro+. ([Pricing](https://clerk.com/pricing))
- Orgs: 100 **MRO** included; 20 members/org without B2B add-on; add-on **$100/mo** ($85 annual) for unlimited members, custom roles, etc. ([Pricing](https://clerk.com/pricing))
- Exceeding 50k MRU forces Pro; exceeding 100 MRO forces B2B add-on; one-month grace. ([Pricing FAQ](https://clerk.com/pricing))

---

## 4. Brief: Auth.js / NextAuth, Supabase Auth, Auth0

These do **not** change the stack’s existing direction unless new facts appear. Recorded only so the comparison is complete.

### Auth.js (NextAuth)

- Official: [https://authjs.dev/concepts/session-strategies](https://authjs.dev/concepts/session-strategies)
- **Owns:** sign-in providers + either encrypted **JWT cookie** (default without DB) or **database session** (opaque session id cookie + row). ([Session strategies](https://authjs.dev/concepts/session-strategies))
- **Where:** your app + optional adapter DB.
- **Fastify / split API:** Auth.js is framework-packaged (Next, Qwik, SvelteKit, Express). Express uses `/auth/signin` style routes. ([Login](https://authjs.dev/getting-started/session-management/login)) A Fastify-first composition root is **not** a first-class guide on the pages fetched.
- **Multi-audience / three Next apps + one Fastify:** **unclear** / not a documented product feature.
- **Ports:** database session is closer to `ISessionStore` than Clerk; still a different schema than `identity.sessions` (audience, customerId).
- **Pricing:** library; no MAU fee.
- **Why it does not change the stack pick:** stack already chose Better Auth (or equivalent **session library**) as adapter; Auth.js is another session library, Next-centric, JWT-default unless you add an adapter.

### Supabase Auth

- Official: [https://supabase.com/docs/guides/auth](https://supabase.com/docs/guides/auth)
- **Owns:** users/sessions in Supabase Auth schema; **JWTs** for API/RLS. ([Auth](https://supabase.com/docs/guides/auth))
- Stack already: hosting may use Supabase **as Postgres only**; **do not** use Supabase Auth/Storage/RLS as the domain. ([`docs/stack.md`](../stack.md) §2)
- Does not change that rejection.

### Auth0

- Official: [https://auth0.com/docs/get-started/auth0-overview](https://auth0.com/docs/get-started/auth0-overview), [pricing](https://auth0.com/pricing)
- **Owns:** hosted IdP (users, passwords, connections, organizations, APIs). Apps and APIs registered in the tenant. ([Overview](https://auth0.com/docs/get-started/auth0-overview))
- **Where:** Auth0 tenant, not `identity.*` as SoT.
- Same v1 rejection as Clerk for **customer SoT**. ([`docs/stack.md`](../stack.md))
- **Pricing (published):** Free 25k MAU; Essentials from **$35/mo B2C / $150/mo B2B** at 500 MAU; Professional from **$240 / $800**; Enterprise custom. ([Pricing](https://auth0.com/pricing))
- No new fact that makes Auth0 the in-process `CustomerId` binder the stack requires.

---

## 5. Cross-cutting facts (repo vs vendors)

| Requirement (stack / identity) | Better Auth library | Neon Managed BA | Clerk |
|---|---|---|---|
| Opaque session cookie, row in **our** Postgres | Yes (your tables) | Yes (`neon_auth.session`) + managed API | No (Clerk JWT `__session` + Clerk session store) |
| Users in **our** Postgres as SoT | Yes (your `user` or mapped tables) | Yes (`neon_auth.user`) | No (webhook copy) |
| Fastify as composition root | Official Fastify handler | JWT verify documented; standalone FE+BE **not supported** yet | Official `@clerk/fastify` |
| Separate cookies per audience | Cookie prefix/name knobs; 2 instances undocumented | One cookie name per Auth instance | `__session` per Clerk app; not audience-named |
| `customerId` on session | additionalFields | Not in JWT; custom claims unsupported | Token metadata or your DB |
| Keep `IPasswordHasher` / `ISessionStore` as writers | Would be replaced or wrapped | Replaced by managed service | Replaced by Clerk |
| Branching auth with Neon DB | Manual (same DB branch copies *your* BA tables if they live there) | First-class isolated Auth URL per branch | Separate from Neon branches |

---

## 6. What official docs do **not** settle

1. Whether **two** Better Auth (or Neon Auth) instances is the intended way to isolate staff vs wholesale, vs one `user` table + `additionalFields`.
2. Whether Neon “standalone frontend + backend” landing will include Fastify + cookie forwarding, or JWT-only.
3. Whether you can keep **`identity.staff_users` / `wholesale_users` as the only user tables** while Better Auth/Neon Auth still run (vs dual-write).
4. Better Auth **license SPDX** (not on the docs pages fetched).
5. Clerk Fastify + **Next.js 16** compatibility beyond the “13.4 and below” sentence.
6. Exact **hash algorithm** Better Auth / Neon Auth use for `neon_auth.account` / `account` password rows.

---

## 7. Source index

- Better Auth: [intro](https://www.better-auth.com/docs/introduction), [install](https://www.better-auth.com/docs/installation), [basic usage](https://www.better-auth.com/docs/basic-usage), [database](https://www.better-auth.com/docs/concepts/database), [sessions](https://www.better-auth.com/docs/concepts/session-management), [cookies](https://www.better-auth.com/docs/concepts/cookies), [Fastify](https://www.better-auth.com/docs/integrations/fastify), [Next.js](https://www.better-auth.com/docs/integrations/next), [organization](https://www.better-auth.com/docs/plugins/organization), [options](https://www.better-auth.com/docs/reference/options)
- Neon: [overview](https://neon.com/docs/auth/overview), [flow](https://neon.com/docs/auth/authentication-flow), [branching](https://neon.com/docs/auth/branching-authentication), [roadmap](https://neon.com/docs/auth/roadmap), [plugins](https://neon.com/docs/auth/guides/plugins), [JWT](https://neon.com/docs/auth/guides/plugins/jwt), [organization](https://neon.com/docs/auth/guides/plugins/organization), [Next.js](https://neon.com/docs/auth/quick-start/nextjs-api-only), [Data API](https://neon.com/docs/data-api/overview)
- Clerk: [how it works](https://clerk.com/docs/guides/how-clerk-works/overview), [orgs](https://clerk.com/docs/guides/organizations/overview), [roles](https://clerk.com/docs/guides/organizations/control-access/roles-and-permissions), [webhooks sync](https://clerk.com/docs/guides/development/webhooks/syncing), [Fastify](https://clerk.com/docs/fastify/getting-started/quickstart), [JWT verify](https://clerk.com/docs/guides/sessions/manual-jwt-verification), [pricing](https://clerk.com/pricing)
- Auth.js: [session strategies](https://authjs.dev/concepts/session-strategies)
- Auth0: [overview](https://auth0.com/docs/get-started/auth0-overview), [pricing](https://auth0.com/pricing)
- Supabase: [Auth](https://supabase.com/docs/guides/auth)
