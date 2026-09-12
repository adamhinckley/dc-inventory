# Onboarding three tiers (throwaway prototype)

Standalone HTML screens for critique. Not product code. No Next, Fastify, Identity, Mailpit, or OpenAPI.

## How to open

From the repo root:

```bash
open prototypes/onboarding-three-tiers/index.html
```

Or serve the folder:

```bash
npx serve prototypes/onboarding-three-tiers
```

Then click through:

1. `wholesale-apply.html` — buyer self-serve apply
2. `internal-review-queue.html` — staff pending applications (+ create-for-them)
3. `internal-create-organization.html` — **Add Company** (Adam / platform): how Adam adds a new wholesale company to the app (slug + first admin name + first admin email)
4. `internal-create-staff.html` — admin creates staff with G8 roles
5. `set-password.html` — invite-link password set

`file://` works. No build step.

## Cleanup

- Delete this **branch** when the related DCI onboarding work ships.
- If these files ever merge to `main`, **delete them in the implementing PR**. Do not keep a living `prototypes/` tree as product surface.

## Linear

Placeholder: link the implementing issues when they exist (wholesale apply / review queue / org + staff invite / set-password). Research context: [Wholesale resale license — onboarding](https://linear.app/adamhinckley/project/wholesale-resale-license-onboarding-620f6bb53aa7).
