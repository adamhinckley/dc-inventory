# Domain docs

How the engineering skills (`/wayfinder`, `/improve-codebase-architecture`, `/setup-matt-pocock-skills`, and siblings) should consume this repo’s domain documentation when exploring the codebase.

## Before exploring, read these

- **[`CONTEXT.md`](../../CONTEXT.md)** at the repo root
- **[`docs/adr/`](../adr/)**: ADRs that touch the area you’re about to work in
- Product companions cited from root [`AGENTS.md`](../../AGENTS.md) when relevant (`docs/architecture.md`, `docs/invariants.md`, `docs/customers.md`, `docs/accounting.md`, …)

If a file doesn’t exist, **proceed silently**. Don’t flag absence; don’t suggest creating docs up front unless the active skill’s own process says to (e.g. `/improve-codebase-architecture` sharpening `CONTEXT.md` during a grill).

## Layout (this repo)

Single-context:

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-…
│   └── …
└── apps/ + packages/
```

There is no root `CONTEXT-MAP.md`. Do not invent a multi-context layout.

## Use the glossary’s vocabulary

When output names a domain concept (issue title, refactor proposal, hypothesis, test name), use the term as defined in `CONTEXT.md` and the locked docs. Don’t drift to synonyms the project avoids (`available` vs `availableToSell`, Organization vs Customer, etc.).

If the concept isn’t in the glossary yet, either you’re inventing language the project doesn’t use (reconsider) or there’s a real gap (note it for domain-modeling / the owner).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (organization id current), but worth reopening because…_
