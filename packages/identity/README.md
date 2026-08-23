# `@dc-inventory/identity`

Staff and wholesale opaque sessions. Better Auth is deferred.

## Layout

- `domain/` — clock, session TTL, ports
- `application/` — login, logout, resolve session (imports domain / shared-kernel only)
- `adapters/` — in-memory stores, scrypt hasher, Drizzle repos
- `persistence/` — Identity Drizzle tables (re-exported from the API Kit barrel)

## Rules

- Use cases never import Fastify, Drizzle, Zod, or a hash library
- Domain/application never import Customers
- Cookies and CORS live in `apps/api` HTTP adapters
