# Future concepts

Design notes for capabilities beyond the first demo slice. They must not force a rewrite when they land.

These files are **contracts and language**, not a ban on implementation. Work packets live in Linear; open the linked project before coding.

| Note | Stance |
| --- | --- |
| [`multi-organization.md`](./multi-organization.md) | **In progress** ([ADR 0007](../adr/0007-organization-id-current-not-deferred.md), [Multi-organization project](https://linear.app/adamhinckley/project/multi-organization-c54d6b9bb02b)). Demo stays one org (`DEFAULT`); composite uniqueness + session overwrite land via ADA-157 children. |

Related current contract: [`../architecture.md`](../architecture.md) · [`../stack.md`](../stack.md) · [`../database-design.md`](../database-design.md) · [`../open-questions.md`](../open-questions.md) · [`../surfaces/`](../surfaces/). Tax **calculation** is v1 — [`../tax.md`](../tax.md). [`../tax-engine.md`](../tax-engine.md) is an earlier design note.
