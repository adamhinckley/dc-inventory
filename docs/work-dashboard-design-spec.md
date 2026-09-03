# Work dashboard design spec

Locked visual contract for the **internal staff dashboard** (`apps/internal`, `packages/ui-internal`). Coding agents copy tokens from [`packages/ui/src/globals.css`](../packages/ui/src/globals.css). Do not invent hex.

**This kit is not the wholesale shop.** `apps/wholesale` keeps its own canvas/ink/accent tokens. Shop screens should reuse the *principles* in this spec (elevation stack, type composites, intent spacing, color + icon + label for status) without importing AppShell, DataTable, or Carbon dashboard variables. See [ADR 0006](./adr/0006-vendor-design-system.md).

**Light is the default.** Warehouse floors and daytime offices stay on Carbon White. Dark is an **opt-in** Gray 100 theme (`.dark` or `data-theme="dark"`) for low-light / night office — not an OS-only invert, and not the app default.

Related: [`architecture.md`](./architecture.md) (internal dashboard reports) · [`stack.md`](./stack.md) (Next.js + Recharts) · [`api-contract.md`](./api-contract.md) (presentation-only UI).

Token **roles** (foreground, surfaces, brand, status) are the same in light and dark. Only values change. Public class names are semantic (`bg-surface-base`, `text-fg`, `page-title`), not Carbon’s `$layer-01` / `$text-primary`.

---

## 1. Locked stacks

| Layer | Lock | Why |
|---|---|---|
| Light theme | IBM Carbon **White** v11 | Daytime office / warehouse. Carbon’s default theme. |
| Dark theme | IBM Carbon **Gray 100** (`g100`) | Opt-in low-light. **Not** Gray 90, **not** a naive invert of White. |
| Type | IBM Plex **productive** (Plex Sans UI, Plex Mono for SKU/code) + `tnum` / `tabular-nums` on numbers | Productive reading, aligned columns for qty / money / SKU. |
| Spacing | **8px grid** (Carbon spacing scale) | Agents do not invent 7px/13px gaps. |
| Charts | **Okabe–Ito** categorical; sequential Blues (reversed on dark) or viridis/cividis; diverging RdBu | Colorblind-safe. No rainbow palettes. |
| Switch | Class-based **`.dark`** | A warehouse terminal can stay light while a night office opts in. `prefers-color-scheme` may *hook* the class; it is not the only switch. |
| Contrast | WCAG 2.2 **1.4.3** (4.5:1 text) and **1.4.11** (3:1 non-text) | Saturated brand blues/reds fail 4.5:1 on dark more often — that is why dark *text* and *links* shift. |
| Status | Color **+ icon + label** | Color is never the only encoding. |

Token **roles** are the same in light and dark. Only values change.

---

## 2. Gray scale (do not invent)

From Carbon [`packages/colors/src/colors.ts`](https://github.com/carbon-design-system/carbon/blob/main/packages/colors/src/colors.ts):

| Step | Hex |
|---|---|
| White | `#ffffff` |
| Gray 10 | `#f4f4f4` |
| Gray 20 | `#e0e0e0` |
| Gray 30 | `#c6c6c6` |
| Gray 40 | `#a8a8a8` |
| Gray 50 | `#8d8d8d` |
| Gray 60 | `#6f6f6f` |
| Gray 70 | `#525252` |
| Gray 80 | `#393939` |
| Gray 90 | `#262626` |
| Gray 100 | `#161616` |

Hovers (same file): `gray90Hover` `#333333`, `gray100Hover` `#292929`, `gray80Hover` `#474747`, `gray10Hover` `#e8e8e8`.

Carbon layering ([color overview](https://carbondesignsystem.com/elements/color/overview/)):

- **White:** layers alternate White / Gray 10.
- **Gray 100:** each layer is one step lighter (Gray 100 → 90 → 80 → 70).

---

## 3. Light tokens (Carbon White) — brief

Default theme. Full roles live on Carbon’s [color tokens](https://carbondesignsystem.com/elements/color/tokens/) **White** tab. Values below are that tab (fetched 2026-08-22) plus `colors.ts`. Use these on `:root`. Dark [§4](#4-dark-tokens-carbon-gray-100-g100) overrides the same keys.

| Token | Hex | Carbon role / source |
|---|---|---|
| `background` | `#ffffff` | `$background` White |
| `layer-01` | `#f4f4f4` | `$layer-01` Gray 10 |
| `layer-02` | `#ffffff` | `$layer-02` White |
| `layer-03` | `#f4f4f4` | `$layer-03` Gray 10 |
| `layer-hover-01` | `#e8e8e8` | `$layer-hover-01` Gray 10 hover |
| `layer-selected-01` | `#e0e0e0` | `$layer-selected-01` Gray 20 |
| `layer-accent-01` | `#e0e0e0` | `$layer-accent-01` Gray 20 (zebra) |
| `field-01` | `#f4f4f4` | `$field-01` Gray 10 |
| `text-primary` | `#161616` | `$text-primary` Gray 100 |
| `text-secondary` | `#525252` | `$text-secondary` Gray 70 |
| `text-helper` | `#6f6f6f` | `$text-helper` Gray 60. Not body copy. |
| `text-on-color` | `#ffffff` | `$text-on-color` on brand/buttons |
| `text-error` | `#da1e28` | `$text-error` Red 60 (light only) |
| `text-inverse` | `#ffffff` | `$text-inverse` on inverse chips |
| `link` / `link-primary` | `#0f62fe` | `$link-primary` Blue 60 |
| `link-hover` | `#0043ce` | `$link-primary-hover` Blue 70 |
| `focus` | `#0f62fe` | `$focus` Blue 60 |
| `focus-inset` | `#ffffff` | `$focus-inset` White |
| `border-subtle` | `#e0e0e0` | `$border-subtle-00` Gray 20 — decorative only |
| `border-strong` | `#8d8d8d` | `$border-strong-01` Gray 50, 3:1 non-text |
| `border-inverse` | `#161616` | `$border-inverse` Gray 100 |
| `background-brand` | `#0f62fe` | `$background-brand` Blue 60 + `text-on-color` |
| `highlight` | `#d0e2ff` | `$highlight` Blue 20 |
| `backdrop` (Carbon `$overlay`) | `#000000` 60% | Modal scrim only. `--color-backdrop` / `bg-backdrop`. Never a tooltip, menu, or dialog card. |
| `status-error` | `#da1e28` | `$support-error` Red 60 + icon + “Error” |
| `status-ok` | `#24a148` | `$support-success` Green 50 + check + “OK” |
| `status-warn` | `#f1c21b` | `$support-warning` Yellow 30 + outline + “Warning”. Never text-only. |
| `status-caution` | `#ff832b` | `$support-caution-major` Orange 40 + outline + label |
| `status-info` | `#0043ce` | `$support-info` Blue 70 + icon + label |
| `status-neutral` | `#8d8d8d` | Gray 50 + “Not started” |

---

## 4. Dark tokens (Carbon Gray 100 / g100)

Copy this table. Roles match light. Values are Carbon **g100**, not inverted White.

Checked against live Carbon on 2026-08-22: [`packages/themes/src/dtcg/g100.json`](https://github.com/carbon-design-system/carbon/blob/main/packages/themes/src/dtcg/g100.json) on `main` (the Gray 100 token tab on [carbondesignsystem.com](https://carbondesignsystem.com/elements/color/tokens/) is client-rendered and served the White table over HTTP). Hex resolved through [`colors.ts`](https://github.com/carbon-design-system/carbon/blob/main/packages/colors/src/colors.ts). **Two values differ from the pre-lock table** — live Carbon wins; see [§4.1](#41-live-carbon-swaps).

| Token | Hex | Carbon role / source |
|---|---|---|
| `background` | `#161616` | `$background` Gray 100 |
| `layer-01` | `#262626` | `$layer-01` Gray 90 |
| `layer-02` | `#393939` | `$layer-02` Gray 80 |
| `layer-03` | `#525252` | `$layer-03` Gray 70 |
| `layer-hover-01` | `#333333` | `$layer-hover-01` `gray90Hover` |
| `layer-selected-01` | `#393939` | `$layer-selected-01` Gray 80 |
| `layer-accent-01` | `#393939` | `$layer-accent-01` Gray 80 (zebra on dark) |
| `field-01` | `#262626` | `$field-01` Gray 90 |
| `text-primary` | `#f4f4f4` | `$text-primary` Gray 10 |
| `text-secondary` | `#c6c6c6` | `$text-secondary` Gray 30 |
| `text-helper` | `#a8a8a8` | `$text-helper` Gray 40 (live g100). Not body copy. |
| `text-on-color` | `#ffffff` | `$text-on-color` on brand/buttons |
| `text-error` | `#ff8389` | Official `$text-error` on Gray 100 = Red 40 ([issue 5024](https://github.com/carbon-design-system/carbon/issues/5024)). Red 60 `#da1e28` **fails** as text on `#161616`. |
| `text-inverse` | `#161616` | `$text-inverse` on light inverse chips |
| `link` / `link-primary` | `#78a9ff` | `$link-primary` on g100 = Blue 40 (`$link-inverse` on White) |
| `link-hover` | `#a6c8ff` | `$link-primary-hover` on g100 = Blue 30 |
| `focus` | `#ffffff` | Dark themes use White focus |
| `focus-inset` | `#161616` | `$focus-inset` Gray 100 so the ring stays 3:1 |
| `border-subtle` | `#393939` | `$border-subtle-00` Gray 80 — decorative only |
| `border-strong` | `#6f6f6f` | `$border-strong-01` Gray 60, 3:1 non-text |
| `border-inverse` | `#f4f4f4` | `$border-inverse` Gray 10 |
| `background-brand` | `#0f62fe` | `$background-brand` Blue 60 still; pair with `text-on-color` |
| `highlight` | `#001d6c` | Live v11 g100 `$highlight` = **Blue 90** (not v10 Blue 80) |
| `backdrop` (Carbon `$overlay`) | `#000000` 60% | Same as light: scrim only (`bg-backdrop`). Not a floating card. |
| `status-error` | `#fa4d56` | `$support-error` on g100 = Red 50 + icon + “Error” |
| `status-ok` | `#42be65` | `$support-success` on g100 = Green 40 + check + “OK”. Do **not** use Green 50 `#24a148` as the only dark success (too dark). |
| `status-warn` | `#f1c21b` | `$support-warning` Yellow 30 + outline `#8e6a00` (Yellow 60) or a light border + black/dark icon + “Warning”. Never as text-only. |
| `status-caution` | `#ff832b` | `$support-caution-major` Orange 40 + outline + label |
| `status-info` | `#4589ff` | `$support-info` on g100 = Blue 50 + icon + label |
| `status-neutral` | `#8d8d8d` | Gray 50 + “Not started” |

Saturated Blue 60 / Red 60 on `#161616` fail WCAG 1.4.3 more often than on White. That is why **links** go to Blue 40 and **error text** goes to Red 40. Status *fills* may stay at the support grade **if** an icon and a text label travel with them.

### 4.1 Live Carbon swaps

| Token | Pre-lock table | Live Carbon v11 g100 | Why we follow live |
|---|---|---|---|
| `highlight` | `#002d9c` (v10 g100 / Blue 80) | `#001d6c` (`{blue.90}` in `g100.json`) | User instruction: if live g100 differs, use live and cite it. |
| `text-helper` | `#8d8d8d` (Gray 50) | `#a8a8a8` (`{gray.40}` in `g100.json`) | Same rule. Still not body copy. Dark text range is White–Gray 50 ([color overview](https://carbondesignsystem.com/elements/color/overview/)); Gray 40 sits in that range. |

All other locked hexes match live g100 + `colors.ts`.

---

## 5. Status = color + icon + label

| Status | Light fill | Dark fill | Required extras |
|---|---|---|---|
| Error | `#da1e28` | `#fa4d56` (fill) / `#ff8389` (text) | Error icon + “Error” |
| OK / success | `#24a148` | `#42be65` | Check icon + “OK” |
| Warning | `#f1c21b` | `#f1c21b` | Outline + dark icon + “Warning”. Not text-only (Yellow 30 on White fails 4.5:1). |
| Caution | `#ff832b` | `#ff832b` | Outline + label |
| Info | `#0043ce` | `#4589ff` | Info icon + label |
| Neutral | `#8d8d8d` | `#8d8d8d` | “Not started” (or equivalent) |

Never encode a pipeline or stock state as red vs green alone.

---

## 6. Tailwind v4 wiring

Repo lock: **Tailwind CSS v4**. Class-based dark: `@custom-variant dark` targeting `.dark` and `[data-theme="dark"]`. Source of truth for the CSS is `packages/ui/src/globals.css`.

Agents write **`bg-surface-base text-fg border-border dark:`** — never raw hex, never `bg-layer-01` / `text-primary` as body text (those Carbon names are retired). Brand blue is `bg-primary-strong` / `text-primary`.

| Role | CSS variable (light hex) | Write this |
|---|---|---|
| Shell background | `--color-surface-base` `#ffffff` | `bg-surface-base` |
| Raised page / sidebar wash | `--color-surface-raised` `#f4f4f4` | `bg-surface-raised` / `.page` |
| Card / table | `--color-surface-card` `#ffffff` | `bg-surface-card` / `.section-flat` |
| Body text | `--color-fg` `#161616` | `text-fg` |
| Secondary text | `--color-fg-secondary` `#525252` | `text-fg-secondary` |
| Helper / muted | `--color-fg-tertiary` `#6f6f6f` | `text-fg-tertiary` |
| Brand fill | `--color-primary-strong` `#0f62fe` | `bg-primary-strong text-primary-content` |
| Error text/fill | `--color-error` `#da1e28` | `text-error` |
| Field border | `--color-border-field` `#8d8d8d` | `border-border-field` |
| Floating card (E3) | `--color-surface-overlay` `#ffffff` | `.overlay` or `bg-surface-overlay` |
| Modal scrim | `--color-backdrop` `rgb(0 0 0 / 60%)` | `bg-backdrop` |
| Charts | `--color-chart-01`…`08` Okabe–Ito | `var(--color-chart-*)` |

Dark overrides the same keys (g100). `chart-08` becomes `#f4f4f4`. `--color-surface-overlay` becomes `#262626`.

Elevation: shell `bg-surface-base` (E0) → `.page` (E1) → `.section` / `.section-flat` (E2) → `.overlay` (E3). Type composites: `page-title`, `page-description`, `text-body`, `text-label`, `section-content-column-header`.

Put `.dark` on a root you control (`<html>` or Storybook). Warehouse kiosks omit the class.

---


## 7. Charts on dark (and light)

Same **Okabe–Ito** categorical set. On dark, replace series `#000000` with `#f4f4f4` (`chart-08` above).

| Series | Name | Light | Dark |
|---|---|---|---|
| `chart-01` | Orange | `#e69f00` | `#e69f00` |
| `chart-02` | Sky blue | `#56b4e9` | `#56b4e9` |
| `chart-03` | Bluish green | `#009e73` | `#009e73` |
| `chart-04` | Yellow | `#f0e442` | `#f0e442` |
| `chart-05` | Blue | `#0072b2` | `#0072b2` |
| `chart-06` | Vermillion | `#d55e00` | `#d55e00` |
| `chart-07` | Reddish purple | `#cc79a7` | `#cc79a7` |
| `chart-08` | Black / paper | `#000000` | `#f4f4f4` |

Source: Okabe & Ito, *Color Universal Design* ([jfly CUD](https://jfly.uni-koeln.de/color/)).

**Sequential:** reverse Carbon / ColorBrewer Blues so **high values are the light end** on dark, or use viridis / cividis. IBM Blue scale (light → dark): `#edf5ff` `#d0e2ff` `#a6c8ff` `#78a9ff` `#4589ff` `#0f62fe` `#0043ce` `#002d9c` `#001d6c` (`colors.ts`). On g100, flip that list.

**Diverging:** RdBu still works.

**Never:** Spectral, RdYlGn, turbo, or any rainbow. Color is never the only series encoding (shape, pattern, or a legend label with the series name).

Recharts consumes **report** series from the API ([`architecture.md`](./architecture.md) §7). Do not pick chart colors in the query.

---

## 8. Type, numbers, space

- **IBM Plex Sans** (productive / UI) for chrome, tables, body.
- **IBM Plex Mono** for SKU, ids, raw codes.
- `font-variant-numeric: tabular-nums` (and Tailwind `tabular-nums`) on qty, money, counts.
- Spacing and sizing on the **8px** grid (Carbon spacing: 2 / 4 / 8 / 12 / 16 / 24 / 32 / 40 / 48).
- Focus: 2px `$focus` ring; add `$focus-inset` when needed for 3:1 against the control.

---

## 9. Do / don’t

| Do | Don’t |
|---|---|
| Use token classes (`bg-surface-base`, `text-fg`, `page-title`) | Raw hex in JSX / class names |
| Keep warehouse / daytime on White (no `.dark`) | Make `prefers-color-scheme` the only switch |
| Opt in to g100 with `.dark` for night office | Use Gray 90 as the app-default dark |
| Pair status color with icon + label | Red/green-only rows or series |
| Dark error *text* = Red 40 `#ff8389` (`text-error` on `.dark`) | Light Red 60 `#da1e28` as dark body/error text |
| Dark links = Blue 40 / 30 (`text-link`) | Blue 60 links on `#161616` as the only affordance |
| Okabe–Ito; `chart-08` → `#f4f4f4` on dark | Spectral / RdYlGn / turbo / rainbow |
| Reverse sequential Blues (or viridis/cividis) on dark | Copy the light sequential as-is |
| Plex, `tnum`, intent spacing (`gap-icon`, `p-card`) | Material dynamic / generated dark, or a naive `#fff` on `#000` invert |
| Wholesale: same principles on shop tokens | Importing AppShell / DataTable / Carbon dashboard vars into `apps/wholesale` |

### Explicitly rejected

| Rejected | Reason |
|---|---|
| Naive `#ffffff` on `#000000` invert of White | Breaks layering, borders, and brand; not a Carbon theme |
| Gray 90 (`#262626`) as the product default dark | Carbon’s darker g100 is the locked opt-in; Gray 90 is a different theme |
| Light `$text-error` Red 60 on g100 | Fails 4.5:1 on `#161616` ([issue 5024](https://github.com/carbon-design-system/carbon/issues/5024)) |
| Green 50 `#24a148` as the only dark success | Too dark on Gray 100; use Green 40 `#42be65` + check + “OK” |
| Material You / dynamic dark | Not the lock; agents must not generate a third palette |
| Rainbow / Spectral / RdYlGn / turbo charts | Not colorblind-safe; color would become the only series cue |
| Transparent or inverse tooltip fill (`tooltip-bg`, `--color-tooltip`, `bg-backdrop` as the card) | Staff cannot read the definition over a table. Use `.overlay`. See [§13](#13-overlay-surfaces-are-opaque). |

---

## 10. Sources

| Source | Use |
|---|---|
| [Carbon color overview](https://carbondesignsystem.com/elements/color/overview/) | Themes, layering, dark text range White–Gray 50, focus polarity |
| [Carbon color tokens](https://carbondesignsystem.com/elements/color/tokens/) | White-theme roles and hex (light table) |
| [Carbon themes overview](https://carbondesignsystem.com/elements/themes/overview/) | Token vs role vs value; White vs g100 examples |
| [Carbon `colors.ts`](https://github.com/carbon-design-system/carbon/blob/main/packages/colors/src/colors.ts) | Canonical gray / blue / red / green / yellow / orange hex |
| [Carbon `g100.json` (DTCG)](https://github.com/carbon-design-system/carbon/blob/main/packages/themes/src/dtcg/g100.json) | Live v11 Gray 100 token → palette-step map |
| [Carbon issue 5024](https://github.com/carbon-design-system/carbon/issues/5024) | `$text-error` on g100 = Red 40 `#ff8389` |
| [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | 1.4.3 contrast (minimum), 1.4.11 non-text contrast |
| [NN/g dark mode](https://www.nngroup.com/articles/dark-mode-users-issues/) | Dark is a nice-to-have; strongest in low light — not the default |
| [FAA HFDS polarity](https://hf.tc.faa.gov/publications/2016-12-human-factors-design-standard/) | Light remains default in bright rooms (warehouse / daytime office) |
| [Okabe & Ito CUD](https://jfly.uni-koeln.de/color/) | Categorical chart series |

---

## 11. Scope

- Internal dashboard copies [`packages/ui/src/globals.css`](../packages/ui/src/globals.css). Do not re-derive hex.
- Wholesale shop and ops licensing UI do **not** consume this token file. Wholesale may mirror elevation / type / spacing *ideas* with shop tokens ([ADR 0006](./adr/0006-vendor-design-system.md)).
- ResourceTable / echarts from the source kit stay out of this repo. Lists stay `DataTable` + `x-table`. Charts stay Recharts.

---

## 12. Form controls (internal dashboard)

One height. Readable actions. Agents copy this; they do not invent `h-*` on a single control.

**Height.** Comfortable-density Input, TextInput, Select, Combobox, Autocomplete, TagInput, NumberInput, DateInput, DateRangeInput, PhoneInput, and Button `md` / `lg` all use `min-h-(--space-input-height)` (38px, `--space-input-height` in `packages/ui/src/tokens/shared.css`). Compact density is FilterBar, list-table toolbars (`DataTable.Search`), and any find / open-by-number / filter text field (`TextInput density="compact"`).

**Search and lookup width.** Those compact search fields stay `w-52` (~208px) and `shrink-0`. They are only as wide as a document number or SKU query needs. Do not give them `flex-1` or `w-full` so they stretch across the page. `LabeledField className="min-w-56 flex-1"` is for real form fields (vendor, product), not search.

**Components.** Use `Input`, `Select`, `Combobox`, `Button`, `Label`, `FieldRow`, and `LabeledField` from `@dc-inventory/ui`. Do not drop a raw `<input>` or `<select>` with one-off padding.

**Field rows.** Horizontal labeled fields plus a trailing button:

```tsx
<FieldRow>
  <LabeledField className="min-w-56 flex-1">
    <Label htmlFor="vendor">Vendor</Label>
    <Combobox id="vendor" ... />
  </LabeledField>
  <Button type="submit" variant="primary">Add Line</Button>
</FieldRow>
```

`FieldRow` is `flex flex-wrap items-end gap-field-group`. `LabeledField` is `flex flex-col gap-field`. The row action is `variant="primary"` at default `md` size. `sm` / `ghost` belong in toolbars and tables, not this row.

**Buttons.** `primary` is the form-row action (blue, `text-primary-content`). `secondary` is Gray 70 fill + white text. `default` is bordered Gray 10 + `text-fg`. Do not use `ghost` or `secondary`+`size="sm"` as the only action next to inputs. If a size is wrong, change `packages/ui/src/ui/Button/Button.tsx`, not the page.

Labels are always **Title Case** and **bold** (`text-button` is 12px / 700; `Button` locks `font-bold`). Do not pass `font-medium` or sentence-case copy (`Save draft` is wrong; `Save Draft` is right). On a page that hosts a table with actions (row, toolbar, or page-level), every `Button` includes a leading lucide icon that matches the verb. Icon-only controls stay on `IconButton`.

**Done when** every control in the row shares `--space-input-height`, the trailing button reads as an action at rest, labels sit `gap-field` above controls, and the next block uses `gap-form-section` or `gap-field-group` rather than sitting on the controls.

---

## 13. Overlay surfaces are opaque

Carbon's `$overlay` token is a **scrim** (black at 60%). This repo maps that to `--color-backdrop` / `bg-backdrop`. Use it only on `Dialog.Backdrop` / `Drawer` dimmers.

E3 floating chrome (tooltip, popover, menu, dialog card, drawer panel) uses `.overlay` or `bg-surface-overlay`. That fill is a solid hex (`#ffffff` light, `#262626` dark). `shadow-overlay` is extra depth. It is not the fill.

There is no `tooltip-bg` class and no `--color-tooltip` fill. Inverse gray tooltips are not in this kit. Pair overlay surfaces with `overlay-title` / `overlay-description` (`text-fg` / `text-fg-secondary`).

```tsx
// Wrong: invented class, no fill, table shows through
<Tooltip.Popup className="tooltip-bg border border-border shadow-overlay">

// Wrong: Carbon $overlay / backdrop as the card
<Tooltip.Popup className="bg-backdrop">

// Right: same surface as Menu and Popover
<Tooltip.Popup className="overlay rounded-section p-3 shadow-overlay">
```

**Done when** you cannot read page or table text through the popup. Alpha on a floating card is a defect. Alpha on `bg-backdrop` is the scrim.
