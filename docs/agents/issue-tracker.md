# Issue tracker: Linear

Issues and specs for this repo live in **Linear**, on the [DC Inventory initiative](https://linear.app/adamhinckley/initiative/dc-inventory-41579ab5d46f/overview). Use the Linear MCP / Linear API for all operations. Canonical rules: [`docs/linear.md`](../linear.md) and root [`AGENTS.md`](../../AGENTS.md) hard rule 9.

## Conventions

- **Team:** Adam Hinckley (unless a ticket says otherwise).
- **Project:** every issue sits in a project that is already on the DC Inventory initiative. Do not leave issues with no project.
- **Create an issue:** Linear `save_issue` (or equivalent) with team, project, title, description. Put implementation tickets in the work-packet shape from `AGENTS.md`.
- **Read an issue:** Linear `get_issue` including description and comments.
- **List issues:** Linear `list_issues` filtered by project / label / state / parent.
- **Comment:** Linear `save_comment`.
- **Labels / state / assignee:** Linear `save_issue` fields.
- **Close:** set state to Done (or Canceled) with a resolution comment when the skill requires one.

Infer the workspace from the Linear MCP session; do not invent a second tracker.

## Pull requests as a triage surface

**PRs as a request surface: no.** GitHub PRs are not triage tickets for this product. Product work enters through Linear.

## When a skill says "publish to the issue tracker"

Create a Linear issue in a project on the DC Inventory initiative.

**`/to-tickets` always creates Linear issues.** Never write tickets under `.scratch/`, and never create GitHub/GitLab issues from that skill.

## When a skill says "fetch the relevant ticket"

Load the Linear issue by id (e.g. `ADA-123`) via `get_issue`, including comments.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single Linear issue with **child** issues as tickets.

- **Map:** one Linear issue labelled `wayfinder:map`, holding the Destination / Notes / Decisions-so-far / Not-yet-specified / Out-of-scope body. Create it in a project on the DC Inventory initiative. Title is the map **name**; always refer to it by that name (wrapping the Linear id/URL), never by a bare number alone.
- **Child ticket:** a Linear **sub-issue** of the map (`parentId` = map). Labels: `wayfinder:grilling`, `wayfinder:prototype`, `wayfinder:research`, or `wayfinder:task` (one type per ticket). Body holds `## Question`. Once claimed, assign the ticket to the driving agent/user.
- **Blocking:** Linear’s **native issue relations** (`blocks` / `blockedBy`) are the canonical, UI-visible edges. A ticket is unblocked when every blocker is Done/Canceled. If relations are unavailable in the current MCP surface, fall back to a `Blocked by: <Ticket Name> (ADA-n)` line at the top of the child description and keep the map’s index honest by hand.
- **Frontier query:** list the map’s open children; drop any with an open blocker or an assignee; first in map/create order wins. Prefer Linear UI “blocked by” views when present so the human can see the frontier without opening the map body.
- **Claim:** assign the ticket to the session driver (`assignee`) before any work — first write of the session.
- **Resolve:** post the answer as a resolution comment, mark the issue Done, then append one gist line (name + link) to the map’s **Decisions so far**. Graduate newly sharp fog into fresh child tickets; clear graduated patches from **Not yet specified**.
