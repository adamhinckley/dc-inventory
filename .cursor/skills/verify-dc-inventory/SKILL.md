---
name: verify-dc-inventory
description: Drive DC Inventory the way a user does. Primary surface is the staff Next.js app apps/internal on port 3000 (catalog DataTable, inventory placeholder, purchasing, staff login). Also covers wholesale :3002 and Fastify :3001. Use when you need to launch, doctor, click through catalog/inventory, or capture proof.
---

# Verify DC Inventory

You are mid-task and have not seen this app. Run this skill. Do not browse the repo for ports or passwords.

Control CLI (repo root):

```bash
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs --help
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs <command> [--json]
```

Every command except `--help` prints one JSON object on stdout. Secrets are omitted. Failed commands exit 1 and include `error.doInstead`.

Read `features/README.md`, then the feature file you are proving.

## Launch

Repo-root commands. This skill is allowed to start `pnpm dev:api` and `pnpm dev:internal` even though ordinary coding tickets are not.

Default stack: Compose Postgres :5432, Fastify :3001, staff app :3000.
Use `http://localhost:3000`, not `http://127.0.0.1:3000`. Next.js 16 blocks `/_next` chunks from 127.0.0.1 when the dev server origin is localhost, so the sign-in form never hydrates.

```bash
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs launch
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs launch --seed phase1 --surfaces api,internal
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs launch --surfaces wholesale
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs launch --dry-run
```

What `launch` does:

1. Copies `.env.example` → `.env` and `apps/api/.env.example` → `apps/api/.env` when those files are missing. That is verification scaffolding, not a product change.
2. Refuses to start if :3000, :3001, or :3002 is already taken by a process this skill did not record. `attach` or `teardown` instead.
3. Runs `docker compose up -d --wait` when `docker` exists. If Docker is missing but `127.0.0.1:5432` accepts a connection, it continues and records `postgres: existing`. If neither, it exits and tells you to install Docker Engine and rerun, or start Postgres 18 locally with user/password/db `postgres` / `postgres` / `dc_inventory`.
4. Runs `pnpm db:migrate`.
5. Seeds `--seed phase1` (`pnpm db:seed:phase1`) by default. `--seed demo` runs `pnpm seed:demo` (localhost-only; needs `DEMO_SEED_RESET=1` to wipe a dirty demo book). `--seed none` skips seed.
6. Starts `pnpm dev:api` and `pnpm dev:internal` (and `pnpm dev:wholesale` if requested). PIDs and log paths go in `.cursor/skills/verify-dc-inventory/.run/state.json`.
7. Waits until `GET http://127.0.0.1:3001/health` and `GET /ready` are 200, and the staff origin answers HTTP.

Ready signals:

- API: `/health` (no DB) then `/ready` (`SELECT 1`).
- Staff: TCP :3000 plus an HTTP response. First compile can take a minute.
- Wholesale: TCP :3002 plus HTTP when that surface was requested.

Teardown is the Cleanup section. `launch --dry-run` prints the planned steps and starts nothing.

`attach` records URLs for a stack you or the owner already started:

```bash
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs attach
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs attach --internal-url http://localhost:3000 --api-url http://localhost:3001
```

Attach never kills those processes.

Ports are shared. Two verification stacks cannot run side by side on this repo's defaults. Do not rewrite `PORT` / Next ports to "make room" unless the owner already did.

## Doctor

Read-only. Run this first whenever anything looks off.

```bash
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs doctor
```

Doctor reports, without writing:

- Whether `.run/state.json` exists and whether recorded PIDs are still alive.
- `GET /health` and `GET /ready` on the API origin.
- HTTP reachability of staff :3000 and, if launched, wholesale :3002.
- Whether :3000/:3001 are owned by recorded PIDs or by a stranger (stranger → do not drive).
- Whether `PHASE1_STAFF_PASSWORD` can be resolved from env or `apps/api/.env`. Value is not printed. `passwordSource` is.
- Playwright install under this skill directory (needed before click/fill).

`ok: true` means the instance is worth driving. `ok: false` includes `doInstead` (launch, attach, install Playwright, copy env example, start Postgres).

Do not drive a staff UI that doctor marks as someone else's process.

## Drive

Browser is Chromium via Playwright, connected to a Chrome instance this CLI started (`--remote-debugging-port`, profile under `.run/chrome-profile`). The first `goto` / `click` / `login-staff` starts that browser. Later commands reuse it.

Prefer role + name. Then `data-testid`. Coordinates require `--force-coords` and are a last resort.

```bash
# staff origin is the default
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs goto --path /catalog
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs login-staff
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs wait-settle
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs click --role link --name Catalog
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs click --role link --name Inventory
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs fill --role textbox --name "Search SKU or name" --value HEX
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs fill --label Email --value staff@local.test
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs fill --label Password --value-from-env PHASE1_STAFF_PASSWORD
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs click --role button --name Continue
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs click --testid auth-sign-in-dialog
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs press --key Escape
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs snapshot --aria --path .cursor/skills/verify-dc-inventory/evidence/catalog-list/table.aria.yml
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs screenshot --path .cursor/skills/verify-dc-inventory/evidence/catalog-list/table.png
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs state
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs goto --path /products --surface wholesale
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs login-wholesale
```

Stable handles from this repo:

| Thing | Handle |
|---|---|
| Staff sign-in dialog | `getByRole('dialog', { name: 'Sign in' })` or `data-testid="auth-sign-in-dialog"` |
| Org / email / password | labels `Organization`, `Email`, `Password` |
| Submit | `getByRole('button', { name: 'Continue' })` |
| Sidebar | Expand first if needed (`Expand navigation` / `DC Workspace`), then `getByRole('navigation', { name: 'Main navigation' })` → link `Catalog`, `Inventory`, `Purchasing`, `Customers`, `Sales`, `Accounting`, `Reports` |
| Catalog heading | `getByRole('heading', { name: 'Catalog' })` |
| Catalog search | `getByRole('textbox', { name: 'Search SKU or name' })` |
| Catalog import | `data-testid="catalog-import-dialog-trigger"` |
| Inventory placeholder | heading `Inventory` |
| Purchasing tabs | `data-testid="purchasing-orders-router-tabs"` |
| Account menu | `data-testid="shell-account-menu-trigger"` |
| Wholesale nav | `getByRole('navigation', { name: 'Shop' })` |

`login-staff` / `login-wholesale` read passwords from the environment. They never echo them.

Catalog after seed is empty (`No rows`). That is the live table. See `features/catalog-list.md`.

## Evidence

Write proof under `.cursor/skills/verify-dc-inventory/evidence/<feature-id>/`. That directory is the named location. Teardown must not delete it.

Minimum for a feature:

1. ARIA snapshot of the resulting screen (`snapshot --aria`).
2. Screenshot that shows the product chrome (`Staff dashboard` or `DC Wholesale`).
3. The command sequence in `commands.json` (optional; write it yourself if you need a transcript).

Standards:

- Drive the user path, not `POST /internal/auth/login` and not test-only endpoints.
- Capture before/after when the action changes the page, not only the last frame.
- Side effects: a session cookie exists after login (`state.staffSessionCookie` is boolean). Catalog seed does not insert products; do not claim SKUs you did not import.
- `--dry-run` on `launch` / `teardown` must not start or kill processes. Confirm by reading `doctor` / `ps` for the recorded PIDs, not by trusting the flag name.

Staff email `staff@local.test` and org `acme` are committed fixtures (`apps/api/src/seed/phase1-fixture.ts`). The password is not. Resolve `PHASE1_STAFF_PASSWORD` from `process.env`, then `apps/api/.env`, then repo `.env`. If all are missing, copy `apps/api/.env.example` to `apps/api/.env` and rerun. Do not invent a password. Do not put the value in a PR body.

## Cleanup

```bash
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs teardown --dry-run
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs teardown
node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs teardown --keep-compose
```

Kills only PIDs in `.run/state.json` (API, Next, Chrome). Then, if this run started Compose, `docker compose stop` unless `--keep-compose`. Removes `.run/chrome-profile` and the state file. Leaves `evidence/` on disk.

Never `pkill -f pnpm` or `pkill -f next`. If a PID is already dead, skip it. If state says `attach: true`, teardown stops only the Chrome this CLI started.

## Helpers

CLI path: `.cursor/skills/verify-dc-inventory/control-dc-inventory.mjs`.

| Command | Role |
|---|---|
| `doctor` | Read-only health |
| `launch` / `attach` / `teardown` | Process lifecycle (`--dry-run` on launch/teardown) |
| `goto` / `click` / `fill` / `type` / `press` | Drive |
| `login-staff` / `login-wholesale` | Form login |
| `wait-settle` | Network idle + no `Signing in…` |
| `snapshot --aria` | Accessibility tree |
| `screenshot` | PNG |
| `state` | URL, title, cookie presence |

First drive command installs Playwright into `.cursor/skills/verify-dc-inventory/node_modules` if needed (`npm install --prefix .cursor/skills/verify-dc-inventory`). Uses the machine `google-chrome` (`channel: "chrome"`). `--help` on the root and on each subcommand lists flags.

Feature recipes: `features/`. Catalog list is the live staff feature. Inventory is a placeholder and still has a file.

After the map changes, run `/maintain-verification-skill`.
