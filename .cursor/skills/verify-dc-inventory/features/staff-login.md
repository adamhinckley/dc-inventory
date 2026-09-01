# Staff login

Staff sign-in opens a form (route `/login` or a blocking dialog on any dashboard URL), accepts organization + email + password, sets the `staff_session` cookie through the Next rewrite to the API, and lands on Catalog.

## Sub-features

- `login-dialog` shows the blocking `Sign in` dialog when `/catalog` is opened with no session.
- `login-route` shows the same fields on `/login`.
- `login-success` accepts `acme` / `staff@local.test` / `PHASE1_STAFF_PASSWORD` and reveals AppShell.
- `login-failure` keeps the form and shows `Sign-in failed.` without inventing a session.

## How to get to it (user POV)

- Open `http://localhost:3000` or `/catalog` while signed out. The dialog titled `Sign in` appears (`data-testid="auth-sign-in-dialog"`).
- Open `/login` directly. Heading `Sign in`. Copy on the page names organization `acme` and email `staff@local.test`.
- After success the dashboard chrome says `Staff dashboard` and the nav includes Catalog.

## Driving it with control-dc-inventory

Preconditions:

- `control doctor` reports API `/health` + `/ready` and staff app HTTP on :3000.
- Phase 1 or demo seed has run so `staff@local.test` exists.
- `PHASE1_STAFF_PASSWORD` is in `apps/api/.env` (copy from `apps/api/.env.example` if the file is missing). Do not type a guessed password.

- **Open signed-out catalog.** Run `node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs goto --path /catalog`. A dialog named `Sign in` or the `/login` heading is visible. Fields: `Organization` (default `acme`), `Email`, `Password`. Submit control is `Continue`.
- **Sign in via helper.** Run `node .cursor/skills/verify-dc-inventory/control-dc-inventory.mjs login-staff`. The helper fills those three fields from seed constants + `PHASE1_STAFF_PASSWORD` and clicks `Continue`. JSON names `passwordSource` (a file or env key), never the secret.
- **Manual fill (same result).** `fill --label Organization --value acme`, `fill --label Email --value staff@local.test`, `fill --label Password --value-from-env PHASE1_STAFF_PASSWORD`, `click --role button --name Continue`.
- **Success.** `wait-settle`. Dialog is gone. URL is `/catalog`. Heading `Catalog` is visible. `state` shows `staffSessionCookie: true` and does not print the cookie value.
- **Failure.** Fill `Password` with a wrong value using `--value` only in a throwaway run. Alert `Sign-in failed.` appears. Do not save that password in evidence.
- **Proof.** `snapshot --aria --path .cursor/skills/verify-dc-inventory/evidence/staff-login/after.aria.yml` and `screenshot --path .cursor/skills/verify-dc-inventory/evidence/staff-login/after.png`. Artifacts show `Staff dashboard` and `Catalog`.

## Gotchas

- The dashboard rewrite sends `/internal/*` to :3001. If the API is down, submit shows `Sign-in failed.` even with a correct password. Run `doctor` before blaming credentials.
- `login-staff` is the user path (form). Do not treat a raw `POST /internal/auth/login` as this feature.
- Cookie name is `staff_session`. A wholesale cookie is rejected here.
- Throttle: too many failures return 429. Stop and wait. Do not spray passwords.
- After `pnpm db:seed:phase1` the login page copy is still the source of truth for email and org. Password stays in env.
