# Operator platform bridge

Companion to [`architecture.md`](./architecture.md) and [`licensing.md`](./licensing.md).

This product is **one satellite**. You will have a **separate monorepo** (your developer business) that sees income, active licenses, and other operator metrics **across this app and others you build**. Customers need a **low-maintenance** way to report issues into that platform.

This document opens the **door in this repo**. It does not implement the other monorepo, and inventory must not wait on it.

Related: [`invariants.md`](./invariants.md) (B1–B10, G20) · [`observability.md`](./observability.md) (Sentry/5xx ≠ customer issue reports) · [`ideas/in-app-feature-requests-to-coding-agents.md`](./ideas/in-app-feature-requests-to-coding-agents.md) (not this; not v1).

---

## 1. Two control planes (do not merge)

| Plane | Repo | Audience | Job |
|---|---|---|---|
| **This product’s ops** | `dc-inventory` (`apps/ops`) | You + this tenant’s business owner | Flags, this tenant’s software payments, add-ons |
| **Operator platform** | **Your other monorepo** | You (all products) | Income across apps, **active licenses**, operator metrics, **issue inbox** |

`apps/ops` is not that platform. Do not grow it into a multi-product analytics suite. The bridge **pushes facts out**. The other repo **aggregates**.

Sentry and `/health` stay in [`observability.md`](./observability.md). They are “the process is sick.” The operator platform is “the software business is running.” A 5xx alert is not a customer issue ticket, and a customer “checkout is confusing” report is not a Sentry event.

---

## 2. The door: one outbound port

```
packages/operator-bridge/
  domain/          # ProductCode, InstallationId, OperatorMessage, ports
  application/     # enqueue after license/income; SubmitIssueReport
  adapters/        # Postgres outbox table, no-op publisher, later HTTPS
  tests/unit/
```

| Port | Job | v1 adapter | Later adapter |
|---|---|---|---|
| `IOperatorPlatform` | Deliver an `OperatorMessage` to your platform | **No-op** (or log) | HTTPS + shared secret |
| `IOperatorOutbox` | Durable local queue (same Postgres) | In-memory; Postgres table | Same table; drain on a timer |
| `IIssueReportRepository` | Save the customer’s report **here** first | In-memory; Postgres | Unchanged |

Other contexts **do not** import your platform’s SDK. Licensing (after a successful `SoftwarePayment` / entitlement change) and the issue use case call **these ports only**.

`ProductCode` for this repo is a stable string, e.g. `dc-inventory`. Future apps use their own codes. `InstallationId` (UUID, once per deploy/tenant) plus `TenantId` is how the other repo tells installations apart.

---

## 3. Fail-soft (locked)

The operator platform is **best-effort after local commit**.

| Must | Must not |
|---|---|
| License, income, and issue **facts persist in this database** even if the other repo is down or does not exist yet | Fail sales confirm, PO receive, staff login, or software-payment recording because publish failed |
| Issue submit returns success when the **local** report is saved | Require a round trip to the other repo before the user sees “we got it” |
| Publish is idempotent (`idempotencyKey` on the message) | Block the request thread on a slow HTTP call to your platform (enqueue, drain later) |
| Payload has **no PAN**, no session tokens, no wholesale customer PII by default | Dump order lines, addresses, or logs into the bridge |

This is **not** Kafka and **not** the inventory outbox. It is one table (or in-memory fake) owned by `operator-bridge`. Inventory movements stay in-process and in the same transaction as today.

When the other repo exists, swapping no-op → HTTPS does not change Licensing or Inventory.

---

## 4. Message kinds (the contract the other repo will ingest)

Envelope (every message):

```ts
{
  productCode: "dc-inventory"
  installationId: string  // UUID
  tenantId: string
  occurredAt: string      // ISO-8601
  idempotencyKey: string  // stable; other repo dedupes
  kind: OperatorMessageKind
  payload: unknown        // per kind; versioned if we add fields
}
```

| Kind | When | Payload (conceptual) | Why you need it |
|---|---|---|---|
| `license.snapshot` | Subscription or add-on grant changes | Plan, status, add-on ids, period bounds — **not** Stripe objects | Active licenses across products |
| `income.recorded` | `SoftwarePayment` reaches `succeeded` (or refund) | `Money`, kind (`subscription` \| `add_on` \| `manual`), `provider_ref` if any | Income |
| `issue.reported` | Customer/staff submits the in-app form | Summary, details, actor type, optional `requestId` / release SHA, local `issueId` | Issue inbox |
| `heartbeat` | Coarse, infrequent (e.g. daily or on ops login) | App version, subscription status, staff seat **count**, last activity — **not** a metrics product | “Is this install alive / what tier” |

Do not add `order.placed` or ATP numbers to this bus. Those are this product’s domain, not your software-business ledger.

If a kind is unused in v1, still **define the type** so agents do not invent a second envelope.

---

## 5. Issue reports (low maintenance)

Goal: a customer (staff or business owner) can tell you something is wrong **without you running a helpdesk inside this monolith**, and without the other platform having to be live.

**In this app**

- One use case: `SubmitIssueReport`.
- One small form on **internal** and **ops** (wholesale shop: optional later; default off so clients do not file into your inbox by accident).
- Fields: short summary (required), details (optional), surface (`internal` \| `ops` \| `wholesale`). Attach `requestId` from the current session when present. Screenshot: optional later via `IFileStorage`; not required to open the door.
- Persist `IssueReport` locally (`new` → `queued` → `forwarded` \| `forward_failed`).
- Enqueue `issue.reported`. User sees “Report received.”
- **No ticket thread, status board, or SLA UI in this app.** That lives in the other repo. v1 may show “submitted” only.

**Not this**

- In-app feature-request → coding agent ([parked idea](./ideas/in-app-feature-requests-to-coding-agents.md)). Different door, not v1.
- Sentry “report feedback” as the only path (no durable local copy, no license context).
- Email-the-developer as the domain (fine as a **temporary** `IOperatorPlatform` adapter; the port stays).

Rate-limit submit. Do not accept arbitrary PII dumps; do not attach order/customer records automatically.

---

## 6. HTTP (this app)

| Route | Auth | Job |
|---|---|---|
| `POST /internal/support/issues` | Staff session | Submit issue |
| `POST /ops/support/issues` | Ops session | Submit issue (business owner or operator) |
| `GET …/support/issues/:id` (optional v1) | Same audience, own reports only | “We have it” — not a helpdesk |

No operator-platform admin on `/internal`. Drain/retry of the outbox is composition-root infrastructure, not a staff screen.

Webhook **inbound** from your platform (e.g. “ticket closed”) is **not** v1. One-way push keeps maintenance low.

---

## 7. Wiring later (other monorepo)

When that repo is ready:

1. It exposes an authenticated ingest URL (HTTPS). This app’s `IOperatorPlatform` adapter POSTs the envelope. Shared secret / HMAC in env — never in git.
2. It stores licenses and income **keyed by `productCode` + `installationId`**.
3. It turns `issue.reported` into whatever inbox you use there (Linear, email, its own table). This app does not care.
4. Optional: this app’s drain job retries `forward_failed` rows. Still no Kafka.

Until then, no-op + local tables means **nothing is lost** when you flip the adapter on (replay unforwarded outbox rows).

---

## 8. Autonomy and tests

| Slice | Autonomy |
|---|---|
| No-op `IOperatorPlatform` + in-memory outbox | High |
| Issue form + Orval hook against existing use case | High |
| HTTPS adapter + HMAC | Medium — owner reviews secrets |
| Choosing heartbeat fields / adding message kinds | Owner — do not invent kinds in a random ticket |

Owner tests:

- Recording a software payment succeeds even if `IOperatorPlatform` throws.
- Submit issue persists locally and enqueues; user success does not depend on publish.
- Duplicate `idempotencyKey` does not create two incomes on a replay.
- Inventory / Sales tests never call the real operator HTTP adapter.

---

## 9. Explicitly not this door

- Building the other monorepo in **this** repo
- Multi-product dashboards inside `apps/ops`
- Streaming inventory or wholesale AR into the operator platform
- Bidirectional ticket chat in v1
- Using the bridge as APM, log drain, or feature flags (flags stay `IFeatures`)
- Requiring the other repo at deploy time for this product to boot
