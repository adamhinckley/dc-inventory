# Other-agent handoff

Required second artifact of a linear-project-review run. Write it after the owner review, in the same reply.

## What it is

One fenced `md` block the owner can copy as the **entire** next prompt. Self-contained: the next agent does not read the owner review, this skill, or the chat.

The next agent **rewrites Linear issue text and relations** so tickets become work packets. It does not implement product tickets, start servers, or move/assign issues unless the owner later approves.

## When there are no findings

Still emit the fence. Body is: project URL, “no rewrite”, and stop. Do not invent tickets.

## Fence body (every finding run)

Lead with a one-line job: rewrite the named issues; do not build the product.

Then, in this order:

1. **Goal** — which issues to edit (ids + URLs). Closed grilling/prototype/map issues stay put unless a cited fact is wrong.
2. **Repo pointers** — `AGENTS.md`, `CONTEXT.md`, work-packet shape in `docs/architecture.md`, plus docs this project cites.
3. **Work-packet shape** — the five fields (Context, Allowed / forbidden, Given, Do, Done). Paste the architecture snippet. Given must be file or symbol names.
4. **Inventory** — the one repo pass, as a table or list: area → existing path/port → missing. This is the reuse map the next agent cites in issue text. Do not tell them to re-search the repo.
5. **Per-issue rewrite** — one heading per issue that had a reuse, gap, or direction finding. For each: reuse target (path), gap to close (owner, blocker, HTTP/`pnpm gen:api`/tests), and the packet to write (Allowed, Forbidden, Given, Do, Done). Name the Linear relations to add or keep.
6. **Cross-cutting** — glossary ownership, `ready-for-agent` only after the five fields exist, blockers whose Given is not produced yet.
7. **Implementer order** — after rewrite, not this pass. Parallel vs blocked.
8. **Stop when** — every named issue has the five fields and cites inventory paths; reply with updated issue URLs; no product code.

## Rules inside the fence

- Write commands, not a recap of the review lists.
- Cite paths and symbols from the inventory. A miss stays a miss.
- Forbidden: inventing ledger qty columns, sales tax, company-wide infinity, auto-confirmed POs, or closing open invariant gaps.
- Phase remainder the map deferred: say so; do not file those tickets unless the owner asked.
- If two tickets share a use case (e.g. replace-lines), say which issue owns the use case and which owns HTTP/UI.

## Done

The reply has the owner review, then one `md` fence that another agent can run without this chat. No second fence. No “also paste the review.”
