---
name: linear-project-review
description: Review a Linear project's plan and issues for reuse, gaps, and agent-ready tickets.
disable-model-invocation: true
---

# Linear project review

Review the Linear project the user named. Do not implement tickets. Do not rewrite issue text unless the user asked.

**Produces:** a review covering every issue plus the project as a whole. After the user approves issues, those issues move to Todo and assign to the invoking user.

If the user did not name a project (name, slug, id, or Linear URL), stop and ask for one. Do not pick a project from the workspace, the repo, the current branch, or conversation context.

## Load

1. Resolve the project (`get_project` with `includeResources: true`, `includeMilestones: true`).
2. Page `list_issues` until exhausted (`project` = that project, `limit` 250, fields at least `id`, `title`, `description`, `status`, `labels`, `parentId`, `priority`, `url`). `get_issue` with `includeRelations: true` when a description is thin or blocking is unclear.
3. Read project resources and any implementation-map issue in full.
4. One repo pass. Read `AGENTS.md`, `CONTEXT.md`, and the architecture / invariant docs the project cites. Search once for existing ports, use cases, HTTP adapters, UI controls, CSV/table/list patterns, seeds, and OpenAPI shapes any ticket in this project would touch. Keep that inventory; score every issue against it. Do not re-search the repo per issue.

Done loading when every issue description is in hand and the inventory exists. A named type, endpoint, table, or UI flow with no inventory hit is a miss — record it, do not start a second repo-wide search.

## Reuse

The project must not advise creating a new pattern when an existing one can already be used.

For each issue that introduces a type, endpoint, table, dialog, import/export, list query, or adapter: name the existing file or port it should follow, or state that none exists. A ticket that sketches a parallel abstraction, a second list/table stack, a new CSV dialect, or a new HTTP shape beside a working one is a reuse finding. Cite the existing path in the finding.

## Gaps

Walk the project's outcome (description, map, milestones) against the issue set. A gap is work the outcome needs that no issue owns — including tests, OpenAPI/`pnpm gen:api`, HTTP wiring, UI, seed/demo, migration, authz/org isolation, inventory quantity ownership, and the seam between two tickets that each assume the other already did it. Order and blockers are gaps when an agent could start a ticket whose `Given` is not produced by an earlier ticket.

## Direction

Every issue needs a very clear direction so an agent knows what to do, and when it is done.

An issue is **agent-ready** when all of these are written, not implied:

- **Context** — which module
- **Allowed / forbidden paths**
- **Given** — existing port, use case, failing test, or fixture (names, not vibes)
- **Do** — the change
- **Done** — an observable stop: tests green for this context, a named route exists, a named screen shows X. "Implement X" or "add support" with no stop is not done.

Score every issue. Missing any of those five is a direction finding on that issue.

Work-packet shape to measure against (`docs/architecture.md`):

```
Context: <module>
Allowed paths: …
Forbidden: …

Given:
- …

Do:
- …
- Run the tests for this context; stop when green
```

## Report

Lead with whether the project is safe to hand to agents. Then three lists, each item an issue id + one sentence + the missing or conflicting evidence:

1. **Reuse** — tickets that invent beside an existing pattern
2. **Gaps** — outcome work with no owner
3. **Direction** — tickets an agent could not start, or could not know were finished

Silence on an issue means it passed. Do not pad with praise.

Stop after the report. Wait for approval. Do not move issues on the review pass.

## Approve

Approval is the user's explicit yes on a named set: passed issues, listed ids, or the whole project. Findings still on an issue stay unmoved unless that issue is in the approved set.

Then, for each approved issue that is not completed or canceled:

1. `list_issue_statuses` for that issue's team. Use the unstarted status named `Todo` or `To Do`.
2. `save_issue` with `id` = the issue, `state` = that status, `assignee` = `"me"`.

Done when every approved issue is in that Todo status, assigned to the invoking user, and the reply lists the ids moved (and any skipped: already done, canceled, or status name missing).
