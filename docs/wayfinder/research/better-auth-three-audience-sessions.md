---
title: "Better Auth for three-cookie Fastify sessions"
tags: [wayfinder, research]
status: active
created: 2026-08-22
---

# Better Auth for three-cookie Fastify sessions

Facts from Better Auth **primary docs** and the current Identity Drizzle schema. **No adopt / not-adopt decision.**

Ticket: [ADA-58](https://linear.app/adamhinckley/issue/ADA-58/better-auth-for-three-cookie-fastify-sessions). Stack target: [`docs/stack.md`](../../stack.md) §5.

## Question restated

Can Better Auth sit as an Identity **adapter only** (Fastify + two Next.js apps) while keeping separate cookies `staff_session` / `wholesale_session`, opaque server-side sessions in Postgres, no JWT in `localStorage`, and wholesale `customerId` bound at login?

## Repo facts (Phase 0 identity schema)

Source: `apps/api/src/infrastructure/schema/identity.ts` (workspace copy as of this research).

- Schema `identity` with three user tables: `staff_users`, `wholesale_users`, `ops_users`. Comment in file: three actor kinds exist **without Better Auth or staff roles**.
- Columns today: emails + timestamps; wholesale has `customer_id`; ops has `kind` + `tenant_id`. **No password column** on any identity table.
- Sessions: `identity.sessions` stores **opaque `id` + `actor_type` + `actor_id` only**. Comment: no JWT / cookie-name columns; `actor_id` is polymorphic.
- Stack §5 names cookies `staff_session`, `wholesale_session`, `ops_session` on three origins; Identity library is specified as adapter, not domain.

## Better Auth product surface (names as of research date)

Official site: [https://www.better-auth.com/](https://www.better-auth.com/). GitHub: [https://github.com/better-auth/better-auth](https://github.com/better-auth/better-auth).

Documented building blocks used below:

| Name | What docs say |
|---|---|
| `betterAuth({ ... })` | Config object: `emailAndPassword`, `socialProviders`, `plugins`, `database`, etc. ([home](https://www.better-auth.com/)) |
| Plugins | First-class extension (2FA, passkey, organization, JWT, multi-session, …). [Plugins](https://www.better-auth.com/docs/concepts/plugins) |
| Drizzle adapter | `@better-auth/drizzle-adapter`, `provider: "pg"`, CLI `npx auth@latest generate`. [Drizzle](https://www.better-auth.com/docs/adapters/drizzle) |
| Fastify | Catch-all `auth.handler` + `fromNodeHeaders` + `auth.api.getSession`. [Fastify](https://www.better-auth.com/docs/integrations/fastify) |
| Next.js | `toNextJsHandler(auth)` on `/api/auth/[...all]`. [Next.js](https://www.better-auth.com/docs/integrations/next) |
| Cookies | Prefix, custom `session_token` name, trusted origins, cross-subdomain. [Cookies](https://www.better-auth.com/docs/concepts/cookies) |
| Additional fields | `user.additionalFields` / `session.additionalFields`. [Database](https://www.better-auth.com/docs/concepts/database#extending-core-schema) |
| Core schema | Tables `user`, `session`, `account`, `verification`. [Database](https://www.better-auth.com/docs/concepts/database#core-schema) |

## Core schema vs existing `identity.*`

Better Auth **requires** four core tables (logical names). Types described in TypeScript; adapters generate ORM/SQL. ([Database — Core Schema](https://www.better-auth.com/docs/concepts/database#core-schema))

| Better Auth table | Required fields (docs) | Existing `identity.*` |
|---|---|---|
| `user` | `id`, `name`, `email`, `emailVerified`, `image?`, `createdAt`, `updatedAt` | Three tables; none has `name` / `emailVerified` / `image`. Email + timestamps only (plus wholesale `customer_id`, ops `kind`/`tenant_id`). |
| `session` | `id`, `userId` (FK), `token`, `expiresAt`, `ipAddress?`, `userAgent?`, `createdAt`, `updatedAt` | `identity.sessions`: `id`, `actor_type`, `actor_id`, timestamps. **No** `token`, `userId`, `expiresAt`. |
| `account` | `id`, `userId`, `issuer`, `accountId`, `providerId`, tokens…, **`password?`**, timestamps | **No table.** |
| `verification` | `id`, `identifier`, `value`, `expiresAt`, timestamps | **No table.** |

Rename / remap (not invent a second core model):

- `user.modelName` / `session.modelName` / `fields` map **one** user model and **one** session model to different table/column names. Type inference still uses original field names (`user.name`, not `user.full_name`). ([Custom Table Names](https://www.better-auth.com/docs/concepts/database#custom-table-names), [Options — user](https://www.better-auth.com/docs/reference/options#user), [Options — session](https://www.better-auth.com/docs/reference/options#session))
- Drizzle adapter can map a schema key `user: schema.users` or `user.modelName: "users"`. PostgreSQL `schemaName` generates a **separate** namespace (example `auth.user` / `auth.session`), not a polymorphic actor table. ([Drizzle — modifying table names](https://www.better-auth.com/docs/adapters/drizzle#modifying-table-names), [custom schema namespace](https://www.better-auth.com/docs/adapters/drizzle#custom-schema-namespace))
- Extra columns go on **that** user/session via `additionalFields` (e.g. `role` with `input: false` so clients cannot set it). ([Extending Core Schema](https://www.better-auth.com/docs/concepts/database#extending-core-schema))

**Not stated in primary docs:** mapping one Better Auth instance onto **two** user tables (`staff_users` and `wholesale_users`) plus polymorphic `actor_type`/`actor_id` sessions as a supported replacement for `user` + `session.userId`.

CLI: `npx auth@latest generate` produces ORM schema from config; Drizzle users then run `drizzle-kit generate` / `migrate`. Kysely `migrate` is not the Drizzle path. ([Database — CLI](https://www.better-auth.com/docs/concepts/database#cli), [Drizzle — schema generation](https://www.better-auth.com/docs/adapters/drizzle#schema-generation--migration))

## Passwords and implied schema change

- Passwords are **not** stored on `user`. They live on **`account`** with credential accounts using issuer `local:credential` and `providerId` `credential`. ([Account table](https://www.better-auth.com/docs/concepts/database#account), [Email & Password — Update password](https://www.better-auth.com/docs/authentication/email-password#update-password), [Email & Password — Configuration](https://www.better-auth.com/docs/authentication/email-password#configuration))
- Default hash: **`scrypt`** (Node built-in). Docs cite OWASP: use scrypt if argon2id is not available. Custom `emailAndPassword.password.hash` / `.verify` example uses `@node-rs/argon2` with **Argon2id**. ([Email & Password — Password Hashing](https://www.better-auth.com/docs/authentication/email-password#configuration); GitHub docs: [email-password.mdx](https://github.com/better-auth/better-auth/blob/canary/docs/content/docs/authentication/email-password.mdx))
- Phase 0 identity schema has **no** `account` table and **no** password column. Using email/password through Better Auth implies **adding** at least the core tables/columns Better Auth expects (CLI generate + Drizzle Kit migrate), or a custom adapter that still presents those models. That is a schema change relative to current `identity.ts`; this note does not classify it as “Phase 0” vs later.

## Sessions, cookies, JWT, localStorage

- Default mechanism: **cookie-based** session. `session_token` cookie is the **opaque** server-side session identifier; session row has `token` used as the cookie value. ([Session Management](https://www.better-auth.com/docs/concepts/session-management), [Cookies](https://www.better-auth.com/docs/concepts/cookies))
- Defaults in library source: cookie attributes `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, `secure` when production / HTTPS. Default name is `` `${cookiePrefix}.${cookieName}` `` with prefix `"better-auth"` and cookie key `session_token` unless overridden. ([`packages/better-auth/src/cookies/index.ts` on `canary`](https://github.com/better-auth/better-auth/blob/canary/packages/better-auth/src/cookies/index.ts); [Security.mdx](https://github.com/better-auth/better-auth/blob/canary/docs/content/docs/reference/security.mdx) — `SameSite=Lax`)
- Custom names: `advanced.cookies.session_token.name` (docs example `"custom_session_token"`). Custom prefix: `advanced.cookiePrefix`. ([Cookies — Custom Cookies](https://www.better-auth.com/docs/concepts/cookies), [Options — advanced](https://www.better-auth.com/docs/reference/options))
- Optional `session.cookieCache`: extra **`session_data`** cookie (signed/JWT/JWE cache). Distinct from the JWT plugin. Cookie cache can keep a revoked session valid until `maxAge`. ([Session Caching](https://www.better-auth.com/docs/concepts/session-management#session-caching))
- JWT plugin: **not** a replacement for the session; `/token` and `set-auth-jwt` for services that need JWTs. Bearer plugin is the documented path if authenticating **with** JWTs. ([JWT plugin](https://www.better-auth.com/docs/plugins/jwt))
- Primary docs do **not** instruct storing session JWTs in `localStorage`. Client uses cookies / `createAuthClient` fetch.

Revocation: `revokeSession` / `revokeOtherSessions` / `revokeSessions`; password change can `revokeOtherSessions`; password reset does **not** revoke other sessions unless `revokeSessionsOnPasswordReset: true`. ([Session Management](https://www.better-auth.com/docs/concepts/session-management), [Revoking Sessions on Password Reset](https://www.better-auth.com/docs/authentication/email-password#revoking-sessions-on-password-reset))

## Two (or three) audiences, cookie names, origins

Documented:

- **One** `session_token` cookie per `betterAuth()` config; name/prefix customizable (above).
- **`trustedOrigins`**: static array, async function, or wildcards. Untrusted cross-origin requests blocked by default. Fastify guide repeats this. ([Options — trustedOrigins](https://www.better-auth.com/docs/reference/options#trustedorigins), [Fastify — Trusted origins](https://www.better-auth.com/docs/integrations/fastify))
- **`baseURL`**: static string or object with `allowedHosts` for multiple hosts (previews / several production hosts). Origin of `fallback` is added to `trustedOrigins`. ([Options — baseURL](https://www.better-auth.com/docs/reference/options#baseurl))
- **`basePath`**: default `/api/auth`; overridden if `baseURL` includes a path. ([Options — basePath](https://www.better-auth.com/docs/reference/options#basepath))
- **Cross-subdomain cookies**: share **the same** session cookie across subdomains (`crossSubDomainCookies.enabled` + `domain`). Docs warn this is for accessing one session on `auth.example.com` and `app.example.com`, not for isolating audiences. ([Cookies — Cross Subdomain](https://www.better-auth.com/docs/concepts/cookies))
- **Safari / split frontend–API domains**: third-party cookie blocking; documented mitigations are reverse-proxy so auth is first-party, or a **shared parent domain**. ([Cookies — Safari, ITP](https://www.better-auth.com/docs/concepts/cookies))
- **Multi Session plugin**: multiple **accounts in the same browser** on **one** auth instance (extra cookies, `setActive`). Not staff vs wholesale origin isolation. ([Multi Session](https://www.better-auth.com/docs/plugins/multi-session))
- **`user` / `session` additionalFields**: can store extra data (e.g. a `customerId` column) with `input: false` so it is server-owned. ([Extending Core Schema](https://www.better-auth.com/docs/concepts/database#extending-core-schema))

**Not found in primary docs (as a named product feature):** three cookie names (`staff_session` / `wholesale_session` / `ops_session`) on three origins with **separate user tables** and a guarantee that a wholesale cookie is rejected on `/internal`. Isolation would be application configuration (separate `betterAuth()` instances and/or Fastify preHandlers checking cookie + route prefix). Docs do not document running multiple instances against two user tables.

Fastify CORS example uses a **single** `origin` string (`CLIENT_ORIGIN`). Credentials `true`. ([Fastify — CORS](https://www.better-auth.com/docs/integrations/fastify))

## Fastify handler vs Next Route Handlers

**Fastify (documented):** mount Better Auth on a catch-all:

- Methods `GET`/`POST`, URL `/api/auth/*`
- Build a Fetch `Request`, `await auth.handler(req)`, copy status/headers/body
- Session in app routes: `auth.api.getSession({ headers: fromNodeHeaders(request.headers) })`

([Better Auth Fastify Integration Guide](https://www.better-auth.com/docs/integrations/fastify))

**Next.js (documented):** `toNextJsHandler(auth)` exporting `GET`/`POST` from `app/api/auth/[...all]/route.ts`. Pages router: `toNodeHandler(auth.handler)`. Optional `nextCookies()` plugin for Server Actions. Docs recommend keeping path `/api/auth/[...all]`. ([Next.js integration](https://www.better-auth.com/docs/integrations/next))

Stack rule (`docs/stack.md` rejected list): **Next.js Route Handlers are not the domain API**; Fastify is the composition root. Primary docs still ship Next Route Handlers as the **default Next integration**. Fastify `auth.handler` is the documented non-Next mount.

Auth client (`createAuthClient` from `better-auth/react`) talks to the configured auth base URL; it does not require the handler to live in Next.

## What the library owns vs what domain/application still own

Library-owned (from docs):

- HTTP auth endpoints under `basePath` (`signIn.email`, `signUp.email`, `signOut`, get-session, password reset, …) via `auth.handler` or `auth.api.*`. ([Email & Password](https://www.better-auth.com/docs/authentication/email-password), [Fastify](https://www.better-auth.com/docs/integrations/fastify))
- Cookie write/read, session row CRUD, password hash/verify when `emailAndPassword.enabled`.
- Optional plugins (orgs, 2FA, JWT, …) and their extra tables.

Still application-owned relative to this repo’s architecture (stack §5 / AGENTS.md; not contradicted by Better Auth docs):

- Actor types (staff / wholesale / ops), RBAC matrix, overwriting wholesale `customerId` from session after Zod parse.
- Choosing cookie **names** and **which origin** may present which cookie (library customizes one name per instance; route-tree rejection is Fastify).
- Whether login is a domain use case that **calls** `auth.api.signInEmail` vs exposing library routes as the public login API.
- Binding `customerId` at login: docs allow `additionalFields` + `input: false` + `databaseHooks` to set server-owned data; they do not define wholesale customer binding.

`databaseHooks` on `user` / `session` / `account` can abort or replace payloads before insert. ([Database Hooks](https://www.better-auth.com/docs/concepts/database#database-hooks))

## Secondary storage / Redis

Docs include optional `secondaryStorage` and an official Redis package for sessions, verification, rate limits. ([Secondary Storage](https://www.better-auth.com/docs/concepts/database#secondary-storage)). This repo’s stack rejects Redis in v1; Postgres-only sessions remain the documented default when no secondary storage is passed.

## Sources

- [https://www.better-auth.com/](https://www.better-auth.com/)
- [https://www.better-auth.com/docs/concepts/database](https://www.better-auth.com/docs/concepts/database)
- [https://www.better-auth.com/docs/concepts/cookies](https://www.better-auth.com/docs/concepts/cookies)
- [https://www.better-auth.com/docs/concepts/session-management](https://www.better-auth.com/docs/concepts/session-management)
- [https://www.better-auth.com/docs/authentication/email-password](https://www.better-auth.com/docs/authentication/email-password)
- [https://www.better-auth.com/docs/adapters/drizzle](https://www.better-auth.com/docs/adapters/drizzle)
- [https://www.better-auth.com/docs/integrations/fastify](https://www.better-auth.com/docs/integrations/fastify)
- [https://www.better-auth.com/docs/integrations/next](https://www.better-auth.com/docs/integrations/next)
- [https://www.better-auth.com/docs/reference/options](https://www.better-auth.com/docs/reference/options)
- [https://www.better-auth.com/docs/plugins/multi-session](https://www.better-auth.com/docs/plugins/multi-session)
- [https://www.better-auth.com/docs/plugins/jwt](https://www.better-auth.com/docs/plugins/jwt)
- [https://github.com/better-auth/better-auth](https://github.com/better-auth/better-auth)
- [https://github.com/better-auth/better-auth/blob/canary/packages/better-auth/src/cookies/index.ts](https://github.com/better-auth/better-auth/blob/canary/packages/better-auth/src/cookies/index.ts)
- [https://github.com/better-auth/better-auth/blob/canary/docs/content/docs/reference/security.mdx](https://github.com/better-auth/better-auth/blob/canary/docs/content/docs/reference/security.mdx)
- [https://github.com/better-auth/better-auth/blob/canary/docs/content/docs/authentication/email-password.mdx](https://github.com/better-auth/better-auth/blob/canary/docs/content/docs/authentication/email-password.mdx)
- Repo: `apps/api/src/infrastructure/schema/identity.ts`, `docs/stack.md` §5
