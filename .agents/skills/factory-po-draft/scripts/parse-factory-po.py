#!/usr/bin/env python3
"""Parse a factory-send xlsx/csv into draft-PO JSON. Stdlib only."""

from __future__ import annotations

import argparse
import csv
import json
import sys
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from xml.etree import ElementTree as ET
from xml.etree.ElementTree import Element

NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REQUIRED = ("ship_date", "canc_date", "mat_num", "quan", "description")
BROWSER_HEADERS = frozenset({"product_id", "item"})


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(2)


def excel_serial_to_iso(value: str) -> str:
    raw = value.strip()
    if not raw:
        return ""
    if len(raw) == 10 and raw[4] == "-" and raw[7] == "-":
        return raw
    try:
        serial = float(raw)
    except ValueError:
        fail(f"unreadable date {raw!r}")
    day = datetime(1899, 12, 30) + timedelta(days=int(serial))
    return day.strftime("%Y-%m-%d")


def money_to_cents(value: str) -> int:
    raw = value.strip()
    if not raw:
        return 0
    return round(float(raw) * 100)


def vendor_from_path(path: Path) -> tuple[str, str]:
    stem = path.stem.strip()
    words = [part for part in stem.replace("_", " ").replace("-", " ").split() if part]
    name_words = [word for word in words if not word.isdigit()]
    name = " ".join(name_words) if name_words else stem
    vendor = "".join(ch for ch in name.upper() if ch.isalnum())[:32] or "FACTORY"
    return name, vendor


def col_letters(ref: str) -> str:
    return "".join(ch for ch in ref if ch.isalpha())


def cell_text(cell: Element, shared: list[str]) -> str:
    kind = cell.get("t")
    node = cell.find("m:v", NS)
    if node is None or node.text is None:
        return ""
    if kind == "s" and node.text.isdigit():
        return shared[int(node.text)]
    return node.text


def read_xlsx_rows(path: Path) -> list[dict[str, str]]:
    with zipfile.ZipFile(path) as archive:
        shared: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("m:si", NS):
                shared.append("".join(text.text or "" for text in item.findall(".//m:t", NS)))
        sheet = ET.fromstring(archive.read("xl/worksheets/sheet1.xml"))
        rows: list[dict[str, str]] = []
        for row in sheet.findall(".//m:sheetData/m:row", NS):
            cells: dict[str, str] = {}
            for cell in row.findall("m:c", NS):
                ref = cell.get("r")
                if ref:
                    cells[col_letters(ref)] = cell_text(cell, shared)
            rows.append(cells)
    if not rows:
        fail("xlsx has no rows")
    letters = sorted(rows[0].keys(), key=lambda key: (len(key), key))
    headers = [rows[0].get(letter, "").strip() for letter in letters]
    mapped: list[dict[str, str]] = []
    for raw in rows[1:]:
        mapped.append({headers[index]: raw.get(letter, "") for index, letter in enumerate(letters) if index < len(headers)})
    return mapped


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        return list(csv.DictReader(handle))


def normalize_header(name: str) -> str:
    return name.strip().lower()


def parse_rows(rows: list[dict[str, str]], source: Path) -> dict[str, object]:
    if not rows:
        fail("no data rows")
    first = {normalize_header(key): key for key in rows[0]}
    if BROWSER_HEADERS <= set(first):
        fail("this is a Product Browser file. Import it in Catalog, not as a draft PO.")
    missing = [name for name in REQUIRED if name not in first]
    if missing:
        fail(f"not a factory-send sheet. missing headers: {', '.join(missing)}")

    def get(row: dict[str, str], name: str) -> str:
        return (row.get(first[name]) or "").strip()

    lines = []
    for row in rows:
        sku = get(row, "mat_num")
        if not sku:
            continue
        qty_raw = get(row, "quan")
        if not qty_raw:
            fail(f"{sku}: empty quan")
        qty = int(float(qty_raw))
        if qty <= 0:
            fail(f"{sku}: quan must be a positive integer")
        name = get(row, "description") or sku
        price_key = first.get("price")
        price = (row.get(price_key) or "").strip() if price_key else ""
        mfg = get(row, "mfg_code") if "mfg_code" in first else ""
        lines.append(
            {
                "sku": sku,
                "name": name,
                "qty": qty,
                "priceCents": money_to_cents(price),
                "supplierSku": mfg or None,
                "shipDate": excel_serial_to_iso(get(row, "ship_date")),
                "cancelDate": excel_serial_to_iso(get(row, "canc_date")),
            }
        )
    if not lines:
        fail("no SKU lines")

    ship_dates = {line["shipDate"] for line in lines}
    cancel_dates = {line["cancelDate"] for line in lines}
    supplier_name, vendor_number = vendor_from_path(source)
    return {
        "source": str(source),
        "supplierName": supplier_name,
        "vendorNumber": vendor_number,
        "shipDate": next(iter(ship_dates)) if len(ship_dates) == 1 else None,
        "cancelDate": next(iter(cancel_dates)) if len(cancel_dates) == 1 else None,
        "lines": lines,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Parse factory-send xlsx/csv to draft PO JSON")
    parser.add_argument("path")
    parser.add_argument("--supplier-name")
    parser.add_argument("--vendor-number")
    args = parser.parse_args()
    path = Path(args.path).expanduser().resolve()
    if not path.is_file():
        fail(f"file not found: {path}")
    suffix = path.suffix.lower()
    rows = read_xlsx_rows(path) if suffix == ".xlsx" else read_csv_rows(path)
    payload = parse_rows(rows, path)
    if args.supplier_name:
        payload["supplierName"] = args.supplier_name
    if args.vendor_number:
        payload["vendorNumber"] = args.vendor_number
    json.dump(payload, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
