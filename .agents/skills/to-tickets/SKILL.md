---
name: to-tickets
description: Break a plan, spec, or the current conversation into tracer-bullet Linear tickets, each declaring its blocking edges via Linear native relations (or Blocked-by lines), always on the DC Inventory initiative.
disable-model-invocation: true
---

# To Tickets

Break a plan, spec, or conversation into a set of **tickets**: tracer-bullet vertical slices, each declaring the tickets that **block** it.

**This repo always publishes to Linear.** Do not write local markdown tickets under `.scratch/`, and do not create GitHub Issues. Tracker rules: [`docs/agents/issue-tracker.md`](../../../docs/agents/issue-tracker.md) and [`docs/linear.md`](../../../docs/linear.md). If that wiring is missing, tell the user to run `/setup-matt-pocock-skills` (Linear-only in this repo).

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes a reference (a spec path, a Linear issue id or URL) as an argument, fetch it via Linear `get_issue` and read its full body and comments.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code. Ticket titles and descriptions should use the project's domain glossary vocabulary (`CONTEXT.md`), and respect ADRs in the area you're touching.

Look for opportunities to prefactor the code to make the implementation easier. "Make the change easy, then make the easy change."

### 3. Draft vertical slices

Break the work into **tracer bullet** tickets.

<vertical-slice-rules>

- Each slice cuts a narrow but COMPLETE path through every layer (schema, API, UI, tests): vertical, NOT a horizontal slice of one layer
- A completed slice is demoable or verifiable on its own
- Each slice is sized to fit in a single fresh context window
- Any prefactoring should be done first

</vertical-slice-rules>

Give each ticket its **blocking edges**: the other tickets that must complete before it can start. A ticket with no blockers can start immediately.

**Wide refactors are the exception to vertical slicing.** A **wide refactor** is one mechanical change (rename a column, retype a shared symbol) whose **blast radius** fans across the whole codebase, so a single edit breaks thousands of call sites at once and no vertical slice can land green. Don't force it into a tracer bullet; sequence it as **expand–contract**. First expand: add the new form beside the old so nothing breaks. Then migrate the call sites over in batches sized by blast radius (per package, per directory), each batch its own ticket blocked by the expand, keeping CI green batch to batch because the old form still exists. Finally contract: delete the old form once no caller remains, in a ticket blocked by every migrate batch. When even the batches can't stay green alone, keep the sequence but let them share an integration branch that all block a final integrate-and-verify ticket; green is promised only there.

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each ticket, show:

- **Title**: short descriptive name
- **Blocked by**: which other tickets (if any) must complete first
- **What it delivers**: the end-to-end behaviour this ticket makes work

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the blocking edges correct: does each ticket only depend on tickets that genuinely gate it?
- Should any tickets be merged or split further?

Iterate until the user approves the breakdown.

### 5. Publish the tickets to Linear

Publish the approved tickets as **Linear issues** only.

1. Pick (or confirm) a **project** that is already on the [DC Inventory initiative](https://linear.app/adamhinckley/initiative/dc-inventory-41579ab5d46f/overview). Never leave an issue with no project. Team: Adam Hinckley unless told otherwise.
2. Create issues in **dependency order** (blockers first) so each ticket’s blocking edges can reference real Linear ids.
3. For each ticket, use Linear `save_issue` with the issue template below. Implementation tickets use the work-packet shape from root `AGENTS.md` (Context / Allowed / Forbidden / Given / Do / Done) inside or instead of the freeform “What to build” section when the ticket is `ready-for-agent`.
4. Wire **blocking** with Linear’s native issue relations (`blocks` / `blockedBy`) when the MCP surface supports them. Otherwise put `Blocked by: <Ticket Name> (ADA-n)` at the top of the description and keep it honest by hand.
5. If the source was a parent Linear issue (spec / map / epic), set `parentId` to that issue when sub-issues are appropriate.
6. Apply a ready-for-agent posture unless instructed otherwise (Linear state/label the team uses for agent-grabbable work; do not invent a second triage vocabulary).

Work the **frontier**: any ticket whose blockers are all Done. For a purely linear chain that means top to bottom.

Do NOT close or modify any parent issue unless the user asks.

<issue-template>

## Parent

A reference to the parent Linear issue (name + id), if the source was an existing issue; otherwise omit.

## What to build

The end-to-end behaviour this ticket makes work, from the user's perspective, not layer-by-layer implementation.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2

## Blocked by

- A reference to each blocking ticket by **name** (wrapping the Linear id), or "None (can start immediately)".

</issue-template>

Avoid specific file paths or code snippets: they go stale fast. Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it and note briefly that it came from a prototype. Trim to the decision-rich parts, not a working demo, just the important bits.

## Forbidden

- Writing tickets under `.scratch/` or any local markdown issue tree
- Creating GitHub Issues / GitLab issues for this skill’s output
- Leaving Linear issues outside a DC Inventory initiative project
