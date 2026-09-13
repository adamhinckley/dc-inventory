---
name: setup-matt-pocock-skills
description: "Configure this repo for the engineering skills on Linear only: confirm issue-tracker + domain-doc pointers. Run once (or to refresh wiring) before first use of wayfinder / to-tickets / siblings."
disable-model-invocation: true
---

# Setup Matt Pocock's Skills (Linear only)

Scaffold — or refresh — the per-repo configuration the engineering skills assume.

**This repo is Linear-only.** Do not offer GitHub Issues, GitLab Issues, or local `.scratch/` markdown as the issue tracker. Product work lives on the [DC Inventory initiative](https://linear.app/adamhinckley/initiative/dc-inventory-41579ab5d46f/overview). Canonical tracker doc: [`docs/agents/issue-tracker.md`](../../../docs/agents/issue-tracker.md).

What this skill owns:

- **Issue tracker**: Linear (MCP / API), always
- **Domain docs**: where `CONTEXT.md` and ADRs live, and the consumer rules for reading them
- **Pointers** in root `AGENTS.md` under `## Agent skills`

This is a prompt-driven skill, not a deterministic script. Explore, present what you found, confirm with the user, then write or refresh files.

## Process

### 1. Explore

Look at the current repo. Read whatever exists; don't assume:

- Root `AGENTS.md` (required here; there is no `CLAUDE.md` in this repo): does `## Agent skills` already exist?
- [`docs/agents/issue-tracker.md`](../../../docs/agents/issue-tracker.md): already present with **Wayfinding operations**?
- [`docs/agents/domain.md`](../../../docs/agents/domain.md)
- Root [`CONTEXT.md`](../../../CONTEXT.md) and [`docs/adr/`](../../../docs/adr/)
- [`docs/linear.md`](../../../docs/linear.md)
- Is the `triage` skill installed? (a `triage` skill folder alongside this one). If not, skip triage-label setup entirely — this repo does not currently ship `triage`.

### 2. Present findings and ask

Summarise what's present and what's missing. Then take the sections in order. One section, one answer, then the next.

**Section A: Issue tracker — Linear (fixed).**

Do **not** ask GitHub / GitLab / local markdown / Other. State:

> This repo tracks work in **Linear** on the DC Inventory initiative. I will keep / refresh `docs/agents/issue-tracker.md` for Linear only (including Wayfinding operations for `/wayfinder` and ticket publish rules for `/to-tickets`).

Ask only:

- Confirm the default **team** (Adam Hinckley) and that every issue must sit in a **project on the DC Inventory initiative**.
- Confirm Linear MCP is how agents create/read/update issues (not `gh issue`).

If the user insists on a different tracker, **stop** and tell them that changing trackers is an owner decision that contradicts `AGENTS.md` hard rule 9 — do not rewrite the tracker to GitHub/local without an explicit owner override recorded in `AGENTS.md`.

**Section B: Triage label vocabulary.** Skip entirely if `triage` isn't installed.

**Section C: Domain docs.** Default to **single-context** (root `CONTEXT.md` + `docs/adr/`). This repo is single-context; write / refresh `docs/agents/domain.md` without offering multi-context unless the user explicitly asks.

### 3. Confirm and edit

Show the user a draft of:

- The `## Agent skills` block in root `AGENTS.md` (update in place; don't duplicate)
- `docs/agents/issue-tracker.md` (Linear + Wayfinding operations)
- `docs/agents/domain.md`

Let them edit before writing.

### 4. Write

**Always edit root `AGENTS.md`.** Do not create `CLAUDE.md` for this repo.

Ensure `## Agent skills` includes at least:

```markdown
## Agent skills

### Issue tracker

Linear on the DC Inventory initiative. See `docs/agents/issue-tracker.md` (includes Wayfinding operations for `/wayfinder`).

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
```

Then write or refresh:

- [`docs/agents/issue-tracker.md`](../../../docs/agents/issue-tracker.md) — Linear only. Must include **Wayfinding operations** and the rule that `/to-tickets` always creates Linear issues (never `.scratch/` or GitHub Issues).
- [`docs/agents/domain.md`](../../../docs/agents/domain.md) — single-context consumer rules. Seed shape may follow [domain.md](./domain.md) but paths must match this repo (`CONTEXT.md`, `docs/adr/`).

**Do not** write GitHub / GitLab / local-markdown tracker files into `docs/agents/`. Those upstream templates are not shipped in this skill folder for this repo.

Omit `docs/agents/triage-labels.md` unless `triage` is installed.

### 5. Done

Tell the user setup is complete and that `wayfinder`, `to-tickets`, `to-spec`, and siblings will read Linear wiring from `docs/agents/issue-tracker.md`. Mention they can edit `docs/agents/*.md` directly later; re-running this skill is only necessary to refresh Linear wiring — not to switch trackers.

## Forbidden

- Offering or configuring GitHub Issues, GitLab Issues, or `.scratch/` markdown as the issue tracker
- Creating a second tracker doc beside `docs/agents/issue-tracker.md`
- Inventing triage labels when `triage` is not installed
