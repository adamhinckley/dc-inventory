# Highlights: Adam Hinckley and David Smith

**Date:** 2026-09-12
**Who:** Adam Hinckley, David Smith (David Christopher's)
**Where:** Email (written Q&A). Filed like a call for the repo.
**Topic:** Order release, iPad pick/check, pick list fields, invoice timing.

Adam sent written questions about SoloView-style order release and an iPad pick list. David answered the same day. Full Q&A: [`transcript.md`](./transcript.md).

Linear project: [Order release — Pick lists](https://linear.app/adamhinckley/project/order-release-pick-lists-488a638175c0). Map: [DCI-32](https://linear.app/adamhinckley/issue/DCI-32).

## What locked

### iPad pick / check (not paper-only helpers)

- Goal: pick orders from an **iPad** instead of paper.
- Scan carton **UPC** → system shows how many pcs / inner boxes are needed.
- Checker scans one UPC per carton; qty **accumulates** toward the line total (boxes can be out of order).
- **Green** = correct. **Red** = problem, labeled: too few, too many, or wrong item.
- Export problem via screenshot or **PDF**.
- **Manager approval code** can override a short (e.g. 144 ordered, 120 found) and **adjust inventory** to the short.
- Invoice uses **post-check adjusted** quantities.

This **supersedes** the earlier plan that line checkmarks would be local visual helpers only.

### Invoice timing

- Pick in progress stays limbo (not AR yet).
- After the pick list is **checked** and the order is ready to ship, **invoice** the items shipping.
- Also wants: **tracking** (or integrate tracking), **shipping fees**, and an **additional fee** slot (rush / handling / tariff — rare but real).

### Release and status

- Keep a **pick in progress** status after Release (SoloView parity).
- **Undo Release** required (rare but happens).
- Normal path: **Release before ship**. Escape hatch: **quick invoice** without Release for a small front-office grab.
- Partial: pick list = **in-stock only**. Remainder auto-splits to `{order}-BO`, then `-BO2`, `-BO3`, …

### Calculate

- Ship % by **dollars**.
- Scarce stock → **oldest order** wins.
- Normally Calculate then Release. Single-order Release may skip Calculate.
- Calculate is a **preview** until Release.

### Pick list document

- Customer **PO #**: yes.
- **Ship Via**: optional dropdown + write-in (some customers mandate a trucker).
- **Location / bin** on each line: required (also on product details).
- Print from iPad + **PDF download** enough for v1 (no auto-printer day one).
- Keep **Pulled / Checked / Packed / Shipped** initials.
- Wish beyond SoloView: on screen show **qty to pull and expected on-hand** (or popup) so pickers know if they are looking in the wrong place.

### Who

- Calculate / Release: mostly **office**.
- iPad: warehouse **pick/pack**. Someone else **Ships / invoices** when the pallet is ready.

## Open / follow-up

| Topic | Status | Linear |
| --- | --- | --- |
| Being-picked as its own open-stock number | David unsure; logic says maybe no limbo; most WMS do it | [DCI-30](https://linear.app/adamhinckley/issue/DCI-30) |
| Available to sell while picking | Adam: already committed, ATP should not move. David did not contradict | — |
| Barcode encoding (UPC + item number) | Both wanted; David wants a **short call** | [DCI-28](https://linear.app/adamhinckley/issue/DCI-28) leftover / [DCI-440](https://linear.app/adamhinckley/issue/DCI-440) |
| Scan unit, persist progress, manager PIN vs role | Not locked in the email | [DCI-440](https://linear.app/adamhinckley/issue/DCI-440) |
| Tracking + fee line shapes at ship | Spoken; grill for v1 | [DCI-441](https://linear.app/adamhinckley/issue/DCI-441) |
| BO document numbers vs `SO-#####` + ledger move | Behavior locked; numbering/ledger detail open | [DCI-442](https://linear.app/adamhinckley/issue/DCI-442) |

## Action items

| # | Who | Action | Done when |
| --- | --- | --- | --- |
| D1 | David | Short call on barcodes (UPC vs item number on carton vs pick list) | Encoding locked on DCI-440 / DCI-28 |
| D2 | David | Decide being-picked limbo vs status + Allocated only | DCI-30 closed |
| A1 | Adam | Keep Linear map + grilling children current from this email | DCI-32 reflects decisions (done 2026-09-12) |
| A2 | Adam | After call fog closes: invariants G5 / §18, then owner-gated tests, then packets | Tests green; `ready-for-agent` only after |
