---
name: factory-po-draft
description: Turn a factory-send spreadsheet into a draft purchase-order curl script.
disable-model-invocation: true
---

# Factory PO draft

User dropped a factory-send `.xlsx` or `.csv`. Parse it with the scripts here, then print a bash script of staff curls that create the catalog SKUs, supplier link, and a draft PO. Do not invent qty or dates. Read them from the sheet.

## Done when

The chat shows a runnable bash script. Run it only if the user asked to write the database.

## Steps

1. Take the spreadsheet path the user attached or named.
2. Guess supplier name and vendor number from the filename. Override if they named a vendor.
3. Parse:

```bash
python3 .agents/skills/factory-po-draft/scripts/parse-factory-po.py "$SHEET" > /tmp/factory-po.json
```

Optional: `--supplier-name "Qingdao Golden" --vendor-number QGOLDEN`

4. Ensure `PHASE1_STAFF_PASSWORD` is exported (read from `apps/api/.env` if needed). The printed script reads it at runtime with placeholder fallback `phase1-staff-placeholder`. Default API is `http://localhost:3001`. Default login is `acme` / `staff@local.test`.
5. Print the curls:

```bash
python3 .agents/skills/factory-po-draft/scripts/print-factory-po-curls.py /tmp/factory-po.json
```

6. Paste that stdout in the reply as a fenced `bash` block. Say the line count, ship date, cancel date, supplier, and extended cents. Keep cancel-before-ship if the sheet has it.

## Sheet shape

Factory send, not Product Browser. Headers must include `ship_date`, `canc_date`, `mat_num`, `quan`, `description`. `price` and `mfg_code` are optional. Excel serial dates become `YYYY-MM-DD`. `mat_num` is the SKU. `quan` is a positive integer.

Product Browser (`product_id`, `item`) is the Catalog import. Stop and say so.

## HTTP the script hits

Staff cookie `staff_session` from `POST /internal/auth/login`. Then:

- `GET /internal/suppliers?q=` then `POST /internal/suppliers` if needed
- `POST /internal/products` (409 duplicate SKU is fine)
- `POST /internal/suppliers/:id/products` (409 already linked is fine)
- `POST /internal/purchase-orders` with `{ supplierId, shipDate, cancelDate, lines: [{ sku, name, qty }] }`

The API must already be up. Core flags default on; `FEATURES_ALL_CORE_ON=0` without a subscription 403s `feature_disabled`.
