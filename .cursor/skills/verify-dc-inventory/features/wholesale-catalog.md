# Wholesale catalog

Wholesale catalog is the client shop product list at `http://127.0.0.1:3002/products`. Cards display price and `available` as the API returned them. The page does not compute stock.

## Sub-features

- `shop-open` shows heading `Products` and eyebrow `Catalog`.
- `shop-empty` shows `No products in the catalog yet.` after seed (catalog persist is off).
- `shop-error` shows `Catalog is unavailable. Start the API with \`pnpm dev:api\` and reload.` when the API is down.
- `shop-cards` renders a list of product cards when rows exist.
- `shop-login` is `/login` with `wholesale@local.test` if a later ticket gates the list.

## How to get to it (user POV)

- Start wholesale (`launch --surfaces wholesale` or `pnpm dev:wholesale`) in addition to the API.
- Open `http://127.0.0.1:3002/products`, or choose `Products` in `Shop` navigation.
- Brand `DC Wholesale` / `Order for your account` also goes to `/products`.
- Footer says `Wholesale client shop — not the staff dashboard.`

## Driving it with control-dc-inventory

Preconditions:

- `control doctor` is green for `api` + `wholesale`. Staff :3000 is not required.
- Browser base is the wholesale origin. `goto` uses `--surface wholesale` or an absolute URL.

- **Attach shop origin.** If you launched only staff earlier, `launch --surfaces wholesale` or `attach` with `--wholesale-url http://127.0.0.1:3002`.
- **Open products.** `goto --path /products --surface wholesale` then `wait-settle`. Heading `Products`. Copy says wholesale prices and availability come from the catalog API and that the page does not compute stock.
- **Empty seed.** After phase 1 or demo seed, the muted line `No products in the catalog yet.` is the expected body.
- **API down.** Stop the API and reload. Alert `Catalog is unavailable. Start the API with \`pnpm dev:api\` and reload.`
- **Sign-in page (optional).** `goto --path /login --surface wholesale`. Heading `Sign in`. Copy names `acme` and `wholesale@local.test`. `login-wholesale` fills `PHASE1_WHOLESALE_PASSWORD` and clicks `Continue`. Land URL is `/products`.
- **Proof.** `snapshot --aria --path .cursor/skills/verify-dc-inventory/evidence/wholesale-catalog/products.aria.yml` and `screenshot --path .cursor/skills/verify-dc-inventory/evidence/wholesale-catalog/products.png`. Artifacts show `DC Wholesale` and `Products`.

## Gotchas

- Port is 3002, not 3000. Driving staff Catalog does not verify this page.
- Shop `available` on a card is display-only. Do not recompute it. Do not call it available-to-sell.
- Seed does not fill shop cards. Empty is correct until Product Browser import (staff) lands products the wholesale list can read.
- Cookie is `wholesale_session`. Do not send it to `/internal`.
