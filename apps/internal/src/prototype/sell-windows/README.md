# Sell Windows prototype (ADA-336)

Throwaway UI prototype. In-memory only — no API.

## Run

```bash
pnpm dev:internal
```

### List (saved windows)

http://localhost:3000/inventory/reopen?variant=C

Table of sell windows. **New Window** opens the editor page.

### New window editor

http://localhost:3000/inventory/reopen/new?variant=C

- Window name
- **Opens** / **Closes** date fields with helper text (not “simulated now”)
- Category / factory **chips**
- SKU review table with session checkboxes
- **Save** applies the window and returns to the list

### Existing window

Click a row, or open `/inventory/reopen/{windowId}?variant=C`. Active windows can **Close Infinity**; closed windows are read-only with **Clone as new**.

### Auto-close demo

Expand **Prototype demo tools** at the bottom of any page to jump “pretend today is” past a close date.

Production `/inventory/reopen` without `?variant=` is unchanged.

## Delete when done

Remove `apps/internal/src/prototype/sell-windows/` and prototype routes under `inventory/reopen/`.
