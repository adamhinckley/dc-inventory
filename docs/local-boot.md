# Local boot — Compose, Postgres, Mailpit

How to start the local demo stack, boot the API, and inspect outbound email in Mailpit. Demo-only locks live in [`demo-assumptions.md`](./demo-assumptions.md); this doc is the operator runbook.

## Start infrastructure

From the repo root:

```bash
docker compose up -d --wait
cp .env.example .env          # optional — defaults match Compose placeholders
cp apps/api/.env.example apps/api/.env
pnpm db:migrate
```

Compose starts:

| Service | Purpose | Host port (default) |
|---|---|---|
| Postgres 18 | API database | `5432` |
| MinIO | Object storage placeholder (unwired) | API `9000`, console `9001` |
| Mailpit | Local SMTP sink + message UI | SMTP `1025`, UI `8025` |

Override host ports via root `.env` (`POSTGRES_PORT`, `MAILPIT_UI_PORT`, `MAILPIT_SMTP_PORT`, etc.).

## Boot the API

```bash
pnpm dev:api
```

`apps/api/.env.example` points `SMTP_HOST=localhost` and `SMTP_PORT=1025` at Mailpit. The composition root wires `IEmailSender` to `SmtpEmailSender` when `SMTP_HOST` is set; unit tests omit it and get `InMemoryEmailSender` instead.

Frontends (owner terminals):

```bash
pnpm dev:internal   # staff dashboard :3000
pnpm dev:wholesale  # wholesale shop :3002
```

See [`README.md`](../README.md) for `.test` hostnames and Fly proxy notes.

## Mailpit — see invite email

Mailpit catches every message the API sends through `IEmailSender`. No real mail leaves your machine.

1. From the repo root, `pnpm mailpit` starts the Mailpit container (if needed) and opens the inbox UI (default [http://localhost:8025](http://localhost:8025)).
2. Boot the API with `apps/api/.env` copied from `.env.example` (SMTP vars set).
3. Or start the whole stack with `docker compose up -d --wait` and open the UI yourself.
4. Trigger an invite once the staff / wholesale invite HTTP packets land. Until then, you can prove the wiring from a Node REPL or a one-off script:

```bash
node --input-type=module -e "
import { createEmailSenderFromEnv } from './apps/api/src/infrastructure/email-sender-config.ts';
const sender = createEmailSenderFromEnv(process.env);
await sender.send({
  to: 'invite@example.test',
  subject: 'DC Inventory invite (smoke)',
  text: 'This is a local Mailpit smoke test.',
});
console.log('sent');
"
```

Run that from the repo root with `apps/api/.env` loaded (or export `SMTP_HOST` / `SMTP_PORT`). Refresh Mailpit — the message appears in the inbox list.

## Ports reference

| Variable | Default | Maps to |
|---|---|---|
| `MAILPIT_SMTP_PORT` | `1025` | Mailpit SMTP (API `SMTP_PORT`) |
| `MAILPIT_UI_PORT` | `8025` | Mailpit web UI |
| `SMTP_HOST` | `localhost` | API process → Mailpit host |
| `SMTP_FROM` | `noreply@dc-inventory.test` | Envelope From on outbound mail |

Production and Fly use a real SMTP relay or ESP later — the port stays `IEmailSender`; do not add SendGrid-only types to domain code.
