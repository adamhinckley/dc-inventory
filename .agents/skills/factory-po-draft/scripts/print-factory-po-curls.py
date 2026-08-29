#!/usr/bin/env python3
"""Print a bash script of staff curls that create a draft factory PO."""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def bash_single(value: str) -> str:
    return "'" + value.replace("'", "'\\''") + "'"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("json_path")
    parser.add_argument("--base-url", default="http://localhost:3001")
    parser.add_argument("--email", default="staff@local.test")
    parser.add_argument("--organization-slug", default="acme")
    args = parser.parse_args()

    payload = json.loads(Path(args.json_path).read_text())
    if payload.get("shipDate") is None or payload.get("cancelDate") is None:
        raise SystemExit("ship_date/canc_date are not uniform across rows. Fix the sheet.")

    supplier = {
        "name": payload["supplierName"],
        "vendorNumber": payload["vendorNumber"],
    }

    print("#!/usr/bin/env bash")
    print("set -euo pipefail")
    print(f"API={bash_single(args.base_url.rstrip('/'))}")
    print('STAFF_PASSWORD="${PHASE1_STAFF_PASSWORD:-phase1-staff-placeholder}"')
    print("JAR=$(mktemp)")
    print("JSON=$(mktemp)")
    print("trap 'rm -f \"$JAR\" \"$JSON\"' EXIT")
    print(f"cat > \"$JSON\" <<'FACTORY_PO_JSON'")
    print(json.dumps(payload, indent=2))
    print("FACTORY_PO_JSON")
    print()
    print("curl -sS -c \"$JAR\" -b \"$JAR\" -H 'content-type: application/json' \\")
    print("  -X POST \"$API/internal/auth/login\" \\")
    print("  --data-binary \"$(python3 -c 'import json,os; print(json.dumps({")
    print(f"      \"organizationSlug\": {json.dumps(args.organization_slug)},")
    print(f"      \"email\": {json.dumps(args.email)},")
    print("      \"password\": os.environ[\"STAFF_PASSWORD\"],")
    print("  }))')\"")
    print("echo")
    print()
    print("EXISTING=$(curl -sS -b \"$JAR\" -G \"$API/internal/suppliers\" \\")
    print(f"  --data-urlencode q={bash_single(payload['vendorNumber'])})")
    print("SUPPLIER_ID=$(VENDOR_NUMBER=" + bash_single(payload["vendorNumber"]) + " \\")
    print("  python3 -c \"import json,os,sys; page=json.loads(sys.argv[1]); want=os.environ['VENDOR_NUMBER']; print(next((r['id'] for r in page.get('items',[]) if r.get('vendorNumber')==want),'') )\" \\")
    print("  \"$EXISTING\")")
    print("if [[ -z \"$SUPPLIER_ID\" ]]; then")
    print("  CREATED=$(curl -sS -b \"$JAR\" -H 'content-type: application/json' \\")
    print("    -X POST \"$API/internal/suppliers\" \\")
    print(f"    --data-binary {bash_single(json.dumps(supplier, separators=(',', ':')))})")
    print("  SUPPLIER_ID=$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])[\"id\"])' \"$CREATED\")")
    print("fi")
    print("echo supplier \"$SUPPLIER_ID\"")
    print()
    print("python3 - \"$API\" \"$JAR\" \"$JSON\" \"$SUPPLIER_ID\" <<'PY'")
    print("import json, subprocess, sys")
    print("api, jar, path, supplier_id = sys.argv[1:5]")
    print("payload = json.loads(open(path, encoding='utf-8').read())")
    print()
    print("def curl(method, url, body=None):")
    print("    cmd = ['curl', '-sS', '-b', jar, '-H', 'content-type: application/json', '-X', method, url]")
    print("    if body is not None:")
    print("        cmd.extend(['--data-binary', json.dumps(body, separators=(',', ':'))])")
    print("    return subprocess.check_output(cmd, text=True)")
    print()
    print("def post_ok(url, body, ok=(201, 409)):")
    print("    raw = subprocess.run(")
    print("        ['curl', '-sS', '-b', jar, '-H', 'content-type: application/json', '-X', 'POST', url,")
    print("         '--data-binary', json.dumps(body, separators=(',', ':')),")
    print("         '-w', '\\n%{http_code}'],")
    print("        check=True, text=True, capture_output=True,")
    print("    ).stdout")
    print("    *lines, code = raw.rsplit('\\n', 1)")
    print("    if int(code) not in ok:")
    print("        raise SystemExit(f'{url} failed {code} {\"\".join(lines)}')")
    print()
    print("for line in payload['lines']:")
    print("    post_ok(f'{api}/internal/products', {")
    print("        'sku': line['sku'], 'name': line['name'], 'uom': 'EA',")
    print("        'memberPriceCents': 0,")
    print("    })")
    print("    supplier_product = {")
    print("        'sku': line['sku'], 'supplierSku': line['supplierSku'],")
    print("    }")
    print("    if line.get('priceCents') is not None:")
    print("        supplier_product['lastPoCostCents'] = line['priceCents']")
    print("    post_ok(f'{api}/internal/suppliers/{supplier_id}/products', supplier_product)")
    print()
    print("body = {")
    print("    'supplierId': supplier_id,")
    print("    'shipDate': payload['shipDate'],")
    print("    'cancelDate': payload['cancelDate'],")
    print("    'lines': [{'sku': line['sku'], 'name': line['name'], 'qty': line['qty']} for line in payload['lines']],")
    print("}")
    print("print(curl('POST', f'{api}/internal/purchase-orders', body))")
    print("PY")


if __name__ == "__main__":
    main()
