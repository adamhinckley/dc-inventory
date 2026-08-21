# Observability (solo software ops, low cost)

Companion to [`architecture.md`](./architecture.md) and [`stack.md`](./stack.md). Those documents define the module map and runtime. This one is **how the solo software operator knows something is wrong**, and how that signal becomes a **coding-agent work packet** without an SRE budget.

Choices optimize for three things, in order:

1. **Surfacing failures** the owner (or an agent) can act on — not vanity dashboards
2. **Lowest sustainable cost** — free tiers and host-native tooling first
3. **Solo software ops** — one builder, no pager rotation, no second observability stack to babysit

---

## 1. What “observability” means here

For this product, observability is **not** a metrics platform. It is a thin loop:

```
something breaks or degrades
  → a cheap signal fires (error, health fail, log pattern)
  → a ticket / work packet with enough context for a coding agent
  → agent opens a PR against the right context
  → owner reviews gated zones (inventory, money, auth)
```

**Build-time coding agents** (any vendor) are the primary remediator for app bugs. Runtime “AI ops agents” that auto-page or auto-hotfix production are **out of scope** ([architecture.md §14](./architecture.md#14-explicitly-deferred)).

If a signal cannot become a concrete fix (file path, stack, request id, or failing invariant), it is noise. Do not add it in v1.

---

## 2. Cost ceiling (v1)

Stay on **free or near-free** tiers. Prefer tools the hosting already includes.

| Budget line | v1 target | Escalation trigger |
|---|---|---|
| Error tracking | Free tier (e.g. Sentry) for API + both Next apps | Paid only when free quota blocks triage |
| Uptime checks | Free external ping of `/health` | Paid only for multi-region or SMS if you truly need it |
| Logs | Host log stream / drain (Fly/Render/Railway + Vercel) | Paid drain only when retention or search is unusable |
| Metrics / APM | Host CPU/memory + request latency from the host or error tool | Full APM (Datadog, New Relic, Grafana Cloud stack) **not** v1 |
| On-call | Owner email / chat webhook; quiet hours OK | No 24/7 vendor pager product |

**Rule:** if a tool needs a second deployable (collector, Prometheus, Loki, ELK), it fails the solo-ops test the same way Kubernetes does in [`stack.md`](./stack.md).

Rough monthly expectation for v1 traffic: **$0–20** beyond what hosting already bills. Observability must not become a third cloud bill.

---

## 3. Recommended stack (v1)

| Signal | Choice | Why this, not the alternative |
|---|---|---|
| App logs | **Pino** (Fastify default) structured JSON; Next.js server logs left structured where the host allows | Agents and greppers need fields (`requestId`, `route`, `actorType`), not prose |
| Correlation | **`requestId`** (or `x-request-id`) on every API response and every log line for that request | Turns “something failed” into one request’s trail |
| Errors | **Sentry** (or equivalent free error product) on Fastify + both Next.js apps | Stack + release + breadcrumb in one place; free tier is enough for a solo shop |
| Health | **`GET /health`** on the API (liveness) + optional **`GET /ready`** (Postgres ping) | Cheap uptime target; host and external monitors both use it |
| Uptime | **Better Stack / UptimeRobot / Checkly free** (or host built-in) hitting `/health` every 1–5 min | Catches “process dead” without APM |
| Host metrics | Whatever Fly/Render/Railway/Vercel already show (CPU, mem, deploy status) | Enough to see OOM / crash loops; no second metrics product |
| Alerts | Email + one chat webhook (Slack/Discord/etc.) from Sentry + uptime | One channel the owner actually reads |

### Explicitly rejected (v1)

| Rejected | Reason |
|---|---|
| Datadog / New Relic / Honeycomb full APM | Cost and solo-software-operator tax. Revisit only when free error+uptime cannot explain incidents. |
| Self-hosted Prometheus + Grafana + Loki / ELK | Extra runtime to babysit. Same rejection class as Kubernetes. |
| OpenTelemetry collector + tracing backend as a default | Fine **later** if you outgrow Sentry breadcrumbs. Do not stand up a collector for v1. |
| Log everything to a paid warehouse (BigQuery, etc.) | Wrong shape for transactional inventory; use reports endpoints for business KPIs. |
| PagerDuty / Opsgenie with multi-escalation | One human. Email/chat is enough. |
| Synthetic browser scripts for every shop flow | Expensive noise. One `/health` + error tracking covers v1; add one critical-path check later if checkout breaks silently. |
| Shipping domain events to an analytics bus for “ops” | Not observability; do not overload the in-process event model. |
| In-product AI that auto-remediates production | Deferred; coding agents fix via PRs after a human or ticket routes the work. |

---

## 4. What we actually watch

Three layers. Keep each one minimal.

### A. Liveness and readiness

| Endpoint | Must prove | Must not do |
|---|---|---|
| `GET /health` | Process is up and can answer HTTP | Touch Postgres, S3, or external APIs |
| `GET /ready` (optional) | Can obtain a DB connection (simple `SELECT 1`) | Run migrations, warm caches, or call S3 |

Both return small JSON, no auth, no stack traces. Uptime monitors hit `/health`. Orchestrators / deploy gates may use `/ready`.

### B. Errors that become tickets

Capture **uncaught exceptions** and **explicit 5xx** from the API and from Next.js server/edge paths that call the API.

| Always include | Never include |
|---|---|
| Exception type/message, stack | Passwords, session tokens, `Authorization`, cookies |
| `requestId`, route, HTTP method | Full request bodies with PII (addresses, phones) by default |
| Release / git SHA | Card PANs (we do not store them; still never log payment secrets) |
| Actor type (`staff` \| `wholesale`) — not raw session ids | Wholesale `customerId` in **public** alerts if that leaks account existence; prefer internal Sentry context only |

Client `4xx` from validation is **not** an alert storm. Log at `warn`/`info`; do not page. Rate-limit and auth failures stay in logs unless volume spikes (optional Sentry metric alert later).

### C. Logs for the trail

Structured fields (illustrative):

```json
{
  "level": "error",
  "time": 1710000000000,
  "requestId": "…",
  "route": "POST /internal/purchase-orders/:id/receive",
  "actorType": "staff",
  "context": "purchasing",
  "msg": "receive failed",
  "err": { "type": "…", "message": "…", "stack": "…" }
}
```

**Retention:** host default (often 7 days) is fine for v1. Do not buy long retention until you have a compliance reason.

**Business KPIs** (open orders, low stock, AR) are **report endpoints** on the internal API ([architecture.md §7](./architecture.md#7-two-http-adapters-same-use-cases)), not an observability product. Do not reinvent Metabase under “monitoring.”

---

## 5. Alert → agent work packet

The point of cheap observability is **action**. When Sentry or uptime fires, turn it into the same shape of work packet used for features ([architecture.md §10](./architecture.md#10-ai-agent-operating-model-build-time)).

### Routing

| Symptom | Likely owner | Agent autonomy |
|---|---|---|
| Uptime down / deploy crash loop | Owner first (hosting, env, secrets) | Agent may inspect recent deploy diff after owner confirms app-side |
| 5xx in Catalog / Customers / shop UI wiring | Coding agent | **High** — stack + Orval/route paths usually enough |
| 5xx in Purchasing / Sales draft flows | Coding agent; owner glances | **Medium** |
| Inventory allocation, ledger, ATP, payment/AR, **tax quote/commit**, authz/session binding | Owner specifies or reviews tightly | **Low** — agent implements only against existing tests |
| Postgres connection / migration failure | Owner | Agent may propose migration fix for **their** schema only |

### Work packet template (incident)

```
Incident: <Sentry issue URL or uptime check name>
Severity: <down | 5xx spike | single error>
requestId: <if known>
Release: <git SHA>
Allowed paths: <packages/<context>/** and related HTTP adapter>
Forbidden: packages/inventory/domain, packages/shared-kernel (unless this incident says otherwise)

Given:
- Stack trace and breadcrumbs from the error tool
- Related log lines for requestId (paste or link)
- Failing route / UI action

Do:
- Reproduce with a unit test or HTTP contract test when possible
- Fix without widening blast radius; no new observability vendors
- Do not log secrets or full PII bodies
- Run the unit tests for this context; stop when green
```

Owner (or a thin automation later) pastes the Sentry link + `requestId` into that template and assigns a coding agent. **Do not** grant production shell access to agents as the default remediation path; fix in git, deploy through the normal pipeline.

### What “good” looks like for an alert

- Fingerprinted (same bug groups; not one alert per request)
- Tied to a **release**
- Includes enough stack to name a package (`catalog`, `sales`, …)
- Actionable in one sitting for the solo software operator

If an alert cannot be turned into the template above, delete or downgrade it.

---

## 6. Where it lives in the codebase

When code exists, wire observability at the **composition root**, not in domain packages:

```
apps/api/infrastructure/     # pino logger, requestId hook, Sentry init, /health /ready
apps/internal/               # Next.js Sentry (or equivalent) for staff UI
apps/wholesale/              # Next.js Sentry (or equivalent) for shop UI
```

| Layer | Allowed | Forbidden |
|---|---|---|
| Domain / application | Domain errors as types; no Sentry SDK | Importing Sentry, Pino, or OpenTelemetry |
| HTTP adapters | Map domain errors → status codes; rely on central error handler | Ad-hoc `console.log` of bodies with secrets |
| Infrastructure | Logger, error reporter, health routes | Business rules |

Central error handler: log structured error → report to Sentry → return safe client JSON (**no stack** to browsers). Matches [`stack.md` §5](./stack.md#5-authentication-and-authorization) (“Do not return stack traces to clients. Log internally.”).

---

## 7. What agents may implement vs owner reviews

| Agents may implement | Owner specifies / reviews |
|---|---|
| Pino + `requestId` hook, `/health` (+ `/ready`) | Alert destinations, paging quiet hours |
| Sentry (or equivalent) SDK wiring behind a thin `IErrorReporter` if you want a port | Sampling rates that drop inventory/money failures |
| Safe error mapping in HTTP adapters | Any log field that might include PII beyond actor type |
| Incident fixes in **high-autonomy** contexts from a work packet | Inventory / money / authz incident fixes |
| Tests that assert domain errors map to the right status code | Production secret values, Sentry DSN in git |

If an agent adds Datadog, a metrics microservice, ELK, or an OpenTelemetry collector “while fixing a bug,” reject the PR. The observability stack is closed until this document changes.

---

## 8. Minimal production picture

```
Uptime monitor ──GET /health──► Fastify
                                   │
Browser ──► Next.js ──► Fastify ───┼──► Postgres
               │           │       │
               │           ├── pino JSON logs → host log stream
               │           └── Sentry (errors + release)
               └── Sentry (UI/server errors)
                                   │
                          email / chat webhook
                                   │
                          incident work packet → coding agent PR
```

**Local:** logs to stdout; Sentry disabled or `dev` environment with low sample rate. Unit tests never call the network error reporter (fake `IErrorReporter` or no-op).

**Prod:** one API process, two frontends, free error tier, free uptime, host logs. That is the entire observability runtime.

---

## 9. Checklist (PR / go-live)

- [ ] `/health` exists and is the uptime target
- [ ] API logs are structured JSON with `requestId`
- [ ] Sentry (or equivalent) is wired for API + both Next apps with **release** = git SHA
- [ ] Client responses never include stack traces or secrets
- [ ] Passwords, cookies, and tokens are never logged
- [ ] Alerts go to one channel the owner reads; fingerprints are grouped
- [ ] Incident runbook uses the agent work packet template
- [ ] No second deployable for metrics/logs; no paid APM in v1 without changing this doc
