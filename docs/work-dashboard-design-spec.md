# Work dashboard design spec

Locked visual contract for the **internal staff dashboard** (`apps/internal`, `packages/ui-internal`). Coding agents copy tokens from this file. Do not invent hex. Do not restyle the wholesale shop or ops UI from this spec unless a later ticket says those apps share the same tokens.

**Light is the default.** Warehouse floors and daytime offices stay on Carbon White. Dark is an **opt-in** Gray 100 theme for low-light / night office — not an OS-only invert, and not the app default.

Related: [`architecture.md`](./architecture.md) (internal dashboard reports) · [`stack.md`](./stack.md) (Next.js + Recharts) · [`api-contract.md`](./api-contract.md) (presentation-only UI) · Linear [ADA-36](https://linear.app/adamhinckley/issue/ADA-36/packagesui-tailwind-shadcn-primitives-storybook) (Tailwind CSS **v4** + shadcn-style primitives; not landed yet).

There is **no** `globals.css` / `tailwind.config` token file in the repo yet. This document is the token source of truth. When ADA-36 adds CSS, copy the `:root` / `.dark` / `@theme` blocks from [§6](#6-tailwind-v4-wiring) so the file and this spec stay identical.

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
| `overlay` | `#000000` 60% | `$overlay` |
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
| `overlay` | `#000000` 60% | `$overlay` `black` @ 0.6 |
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

Repo lock: **Tailwind CSS v4** ([ADA-36](https://linear.app/adamhinckley/issue/ADA-36/packagesui-tailwind-shadcn-primitives-storybook)). Class-based dark: `@custom-variant dark` targeting `.dark`. Do not use `darkMode: 'media'` as the only switch.

`@theme inline` maps utilities to the CSS variables already defined on `:root` / `.dark`. It does **not** re-declare the hex. That is how one class (`bg-background`) tracks the theme.

### 6.1 CSS variables (copy-paste)

```css
:root {
  --color-background: #ffffff;
  --color-layer-01: #f4f4f4;
  --color-layer-02: #ffffff;
  --color-layer-03: #f4f4f4;
  --color-layer-hover-01: #e8e8e8;
  --color-layer-selected-01: #e0e0e0;
  --color-layer-accent-01: #e0e0e0;
  --color-field-01: #f4f4f4;
  --color-text-primary: #161616;
  --color-text-secondary: #525252;
  --color-text-helper: #6f6f6f;
  --color-text-on-color: #ffffff;
  --color-text-error: #da1e28;
  --color-text-inverse: #ffffff;
  --color-link: #0f62fe;
  --color-link-hover: #0043ce;
  --color-focus: #0f62fe;
  --color-focus-inset: #ffffff;
  --color-border-subtle: #e0e0e0;
  --color-border-strong: #8d8d8d;
  --color-border-inverse: #161616;
  --color-background-brand: #0f62fe;
  --color-highlight: #d0e2ff;
  --color-overlay: rgb(0 0 0 / 60%);
  --color-status-error: #da1e28;
  --color-status-ok: #24a148;
  --color-status-warn: #f1c21b;
  --color-status-caution: #ff832b;
  --color-status-info: #0043ce;
  --color-status-neutral: #8d8d8d;
  --color-chart-01: #e69f00;
  --color-chart-02: #56b4e9;
  --color-chart-03: #009e73;
  --color-chart-04: #f0e442;
  --color-chart-05: #0072b2;
  --color-chart-06: #d55e00;
  --color-chart-07: #cc79a7;
  --color-chart-08: #000000;
}

.dark {
  --color-background: #161616;
  --color-layer-01: #262626;
  --color-layer-02: #393939;
  --color-layer-03: #525252;
  --color-layer-hover-01: #333333;
  --color-layer-selected-01: #393939;
  --color-layer-accent-01: #393939;
  --color-field-01: #262626;
  --color-text-primary: #f4f4f4;
  --color-text-secondary: #c6c6c6;
  --color-text-helper: #a8a8a8;
  --color-text-on-color: #ffffff;
  --color-text-error: #ff8389;
  --color-text-inverse: #161616;
  --color-link: #78a9ff;
  --color-link-hover: #a6c8ff;
  --color-focus: #ffffff;
  --color-focus-inset: #161616;
  --color-border-subtle: #393939;
  --color-border-strong: #6f6f6f;
  --color-border-inverse: #f4f4f4;
  --color-background-brand: #0f62fe;
  --color-highlight: #001d6c;
  --color-overlay: rgb(0 0 0 / 60%);
  --color-status-error: #fa4d56;
  --color-status-ok: #42be65;
  --color-status-warn: #f1c21b;
  --color-status-caution: #ff832b;
  --color-status-info: #4589ff;
  --color-status-neutral: #8d8d8d;
  --color-chart-01: #e69f00;
  --color-chart-02: #56b4e9;
  --color-chart-03: #009e73;
  --color-chart-04: #f0e442;
  --color-chart-05: #0072b2;
  --color-chart-06: #d55e00;
  --color-chart-07: #cc79a7;
  --color-chart-08: #f4f4f4; /* Okabe–Ito black → Gray 10 on dark */
}
```

Put `.dark` on a root you control (`<html>` or the dashboard shell). Warehouse kiosks omit the class.

Optional hook (not the only switch):

```ts
if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
  document.documentElement.classList.add('dark');
}
```

Staff must still be able to force light on a bright floor.

### 6.2 `@theme inline` + `@custom-variant dark`

Text-role tokens drop the `text-` prefix in the Tailwind color key so utilities read `text-primary`, not `text-text-primary`.

```css
@import "tailwindcss";

@custom-variant dark (&:where(.dark, .dark *));

@theme inline {
  --color-background: var(--color-background);
  --color-layer-01: var(--color-layer-01);
  --color-layer-02: var(--color-layer-02);
  --color-layer-03: var(--color-layer-03);
  --color-layer-hover-01: var(--color-layer-hover-01);
  --color-layer-selected-01: var(--color-layer-selected-01);
  --color-layer-accent-01: var(--color-layer-accent-01);
  --color-field-01: var(--color-field-01);
  --color-primary: var(--color-text-primary);
  --color-secondary: var(--color-text-secondary);
  --color-helper: var(--color-text-helper);
  --color-on-color: var(--color-text-on-color);
  --color-error: var(--color-text-error);
  --color-inverse: var(--color-text-inverse);
  --color-link: var(--color-link);
  --color-link-hover: var(--color-link-hover);
  --color-focus: var(--color-focus);
  --color-focus-inset: var(--color-focus-inset);
  --color-border-subtle: var(--color-border-subtle);
  --color-border-strong: var(--color-border-strong);
  --color-border-inverse: var(--color-border-inverse);
  --color-background-brand: var(--color-background-brand);
  --color-highlight: var(--color-highlight);
  --color-overlay: var(--color-overlay);
  --color-status-error: var(--color-status-error);
  --color-status-ok: var(--color-status-ok);
  --color-status-warn: var(--color-status-warn);
  --color-status-caution: var(--color-status-caution);
  --color-status-info: var(--color-status-info);
  --color-status-neutral: var(--color-status-neutral);
  --color-chart-01: var(--color-chart-01);
  --color-chart-02: var(--color-chart-02);
  --color-chart-03: var(--color-chart-03);
  --color-chart-04: var(--color-chart-04);
  --color-chart-05: var(--color-chart-05);
  --color-chart-06: var(--color-chart-06);
  --color-chart-07: var(--color-chart-07);
  --color-chart-08: var(--color-chart-08);
}
```

If `@theme inline` self-reference fights the ADA-36 / shadcn setup, follow that file’s existing pattern (shadcn often uses `--background` on `:root` and `--color-background: var(--background)` in `@theme`). Do not invent a second palette. Do not add an npm dependency for tokens.

### 6.3 Color keys → utilities (required)

| Token | CSS variable | Tailwind color key | Write this |
|---|---|---|---|
| `background` | `--color-background` | `background` | `bg-background` |
| `layer-01` | `--color-layer-01` | `layer-01` | `bg-layer-01` |
| `text-primary` | `--color-text-primary` | `primary` | `text-primary` |
| `text-secondary` | `--color-text-secondary` | `secondary` | `text-secondary` |
| `text-error` | `--color-text-error` | `error` | `text-error` |
| `border-strong` | `--color-border-strong` | `border-strong` | `border-border-strong` |
| `status-error` | `--color-status-error` | `status-error` | `text-status-error` |
| (any, in dark) | (same vars) | (same keys) | `dark:bg-background` |

Agents write **`bg-background text-primary border-border-strong dark:`** — never raw hex in product classes.

```html
<main class="bg-background text-primary">
  <section class="bg-layer-01 text-secondary border border-border-strong">
    <p class="text-error">Qty must be a whole number.</p>
    <p class="text-status-error">Error — allocation failed</p>
  </section>
</main>

<html class="dark">
  <body class="dark:bg-background dark:text-primary">…</body>
</html>
```

`text-error` = form / inline message (`$text-error`). `text-status-error` = status fill (still pair with icon + “Error”).

### 6.4 If a later app is Tailwind v3

Not the current lock. If someone adds a v3 app anyway: `darkMode: 'class'` and `theme.extend.colors` pointing at `var(--color-*)`. Same CSS variables. Same class names.

```js
// tailwind.config.js — v3 only
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        primary: 'var(--color-text-primary)',
        secondary: 'var(--color-text-secondary)',
        'layer-01': 'var(--color-layer-01)',
        'border-strong': 'var(--color-border-strong)',
        'status-error': 'var(--color-status-error)',
      },
    },
  },
};
```

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
| Use token classes (`bg-background`, `text-primary`) | Raw hex in JSX / class names |
| Keep warehouse / daytime on White (no `.dark`) | Make `prefers-color-scheme` the only switch |
| Opt in to g100 with `.dark` for night office | Use Gray 90 as the app-default dark |
| Pair status color with icon + label | Red/green-only rows or series |
| Dark error *text* = Red 40 `#ff8389` | Light Red 60 `#da1e28` as dark body/error text |
| Dark links = Blue 40 / 30 | Blue 60 links on `#161616` as the only affordance |
| Okabe–Ito; `chart-08` → `#f4f4f4` on dark | Spectral / RdYlGn / turbo / rainbow |
| Reverse sequential Blues (or viridis/cividis) on dark | Copy the light sequential as-is |
| 8px grid, Plex, `tnum` | Material dynamic / generated dark, or a naive `#fff` on `#000` invert |

### Explicitly rejected

| Rejected | Reason |
|---|---|
| Naive `#ffffff` on `#000000` invert of White | Breaks layering, borders, and brand; not a Carbon theme |
| Gray 90 (`#262626`) as the product default dark | Carbon’s darker g100 is the locked opt-in; Gray 90 is a different theme |
| Light `$text-error` Red 60 on g100 | Fails 4.5:1 on `#161616` ([issue 5024](https://github.com/carbon-design-system/carbon/issues/5024)) |
| Green 50 `#24a148` as the only dark success | Too dark on Gray 100; use Green 40 `#42be65` + check + “OK” |
| Material You / dynamic dark | Not the lock; agents must not generate a third palette |
| Rainbow / Spectral / RdYlGn / turbo charts | Not colorblind-safe; color would become the only series cue |

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

## 11. What this PR does not do

- No product UI restyle. No new npm package. No `globals.css` until ADA-36 (or equivalent) owns that file.
- Wholesale shop and ops licensing UI are out of scope.
- Agents implementing dashboard chrome later: copy [§6](#6-tailwind-v4-wiring), do not re-derive hex.
