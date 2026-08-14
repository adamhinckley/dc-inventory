# In-app feature requests → coding agents

Parked idea. Not architecture. Not v1.

## Idea

The **internal** app exposes a way for staff (or the owner) to request a change in product language (“CSV export of open POs by vendor”). That request kicks a **build-time** coding agent against this repo. The agent opens a PR (and eventually a staging/preview deploy). A human still gates inventory, money, and auth — and merge/promote to prod.

This is a **control plane** (intake, status, preview, approve) for the existing build-time agent operating model in [`architecture.md`](../architecture.md) §10. It is not in-product domain AI (reorder bots, chat that mutates stock).

## Viability ladder (today)

1. **Highest reliability:** config / allowlisted change types — saved views, report defs, form fields — not freeform code for every request.
2. **Strong today:** in-app request → agent PR → human review → deploy (what the architecture already assumes for coding agents).
3. **Frontier but doable:** agent → CI green → staging/preview auto → human one-click promote to prod.
4. **Not ready for this domain:** unsupervised prod for ledger, payments, sessions, or wholesale checkout.

## Constraints if ever built

- Force scoped intake: acceptance criteria and which surface (internal vs wholesale).
- Prefer allowlisted slices; keep human gate on stock and money.
- Treat the in-app piece as orchestration, not “AI engineer with prod keys.”
