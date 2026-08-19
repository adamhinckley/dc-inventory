# DC Inventory Build Agents (Buzz persona pack)

Portable Buzz [persona pack](https://github.com/block/buzz/blob/main/crates/buzz-persona/PERSONA_PACK_SPEC.md) for the cost-tiered agent roster that builds this app.

Also usable as **Cursor Cloud Agent** prompts: paste the markdown body of any `agents/*.persona.md` and pick the Cursor model from the table below.

All Cursor/Linear **projects**, **issues**, and **sub-initiatives** for this work belong on the [DC Inventory initiative](https://linear.app/adamhinckley/initiative/dc-inventory-41579ab5d46f/overview) — see [`docs/linear.md`](../../linear.md).

## Roster

| Persona | Job | Cost tier | Buzz `model` (default) | Cursor pick |
|---|---|---|---|---|
| `scaffold` | Monorepo skeleton, kernel, Vitest, OpenAPI/Orval/`DataTable` | Mid | `openai:gpt-5.6-terra` | Composer 2.5 or Sonnet 5 |
| `identity` | Staff + wholesale sessions, two mounts, two specs | Strong | `anthropic:claude-opus-5` | Opus 5 / GPT-5.6 Sol |
| `catalog` | Products, images, prices, CRUD + tables | Cheap | pack default (Luna) | Composer 2.5 |
| `customers` | Accounts, contacts, terms | Cheap | pack default | Composer 2.5 |
| `shop-ui` | Wholesale browse / PDP / cart | Cheap | pack default | Composer 2.5 |
| `dashboard-ui` | Internal tables/charts on existing reports | Cheap | pack default | Composer 2.5 |
| `purchasing-sales` | PO create/receive, sales drafts (no allocation math) | Mid | `anthropic:claude-sonnet-5` | Sonnet 5 / Composer 2.5 |
| `inventory` | Ledger/ATP **only after owner tests** | Strong | `anthropic:claude-opus-5` | Opus 5 / GPT-5.6 Sol |
| `accounting` | Invoice/payment **only after owner tests** | Strong | `anthropic:claude-opus-5` | Opus 5 / GPT-5.6 Sol |
| `fixit` | CI red / Sentry work packets in high-autonomy areas | Cheap | pack default | Composer 2.5 |

## Import into Buzz

From a machine with `buzz` CLI and your relay:

```bash
# Validate this pack (local, no relay)
buzz pack validate --path docs/agents/dc-inventory-pack
buzz pack inspect --path docs/agents/dc-inventory-pack

# Create agents via Desktop draft forms (one per persona)
# Replace CHANNEL with a channel UUID from: buzz channels list
buzz agents draft-create \
  --channel CHANNEL \
  --display-name "Catalog" \
  --system-prompt - < docs/agents/dc-inventory-pack/agents/catalog.persona.md
```

After save in Desktop, set **model / provider** to match the table (or run `buzz agents draft-update` with `--model` / `--provider`).

Adjust `model:` frontmatter if your Buzz runtime uses different provider IDs (Goose `provider:model` strings).

## Concurrency

Do **not** run `inventory` and another agent that edits `packages/inventory` or `packages/shared-kernel` at the same time. Prefer at most two cheap agents in parallel (e.g. `catalog` + `customers`).

## Layout

```
docs/agents/dc-inventory-pack/
  .plugin/plugin.json
  instructions.md
  README.md
  agents/*.persona.md
```
