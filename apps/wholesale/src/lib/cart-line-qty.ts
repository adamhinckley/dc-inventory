export function parseCartQty(raw: string): number | null {
  if (!/^\d+$/.test(raw.trim())) {
    return null;
  }
  const qty = Number(raw);
  if (!Number.isInteger(qty) || qty < 0) {
    return null;
  }
  return qty;
}

/** Locked catalog cap; `null` means open (no numeric shop cap). */
export function cartQtyOverCap(qty: number, maxQty: number | null): boolean {
  return maxQty !== null && qty > maxQty;
}

export function cartQtyCapMessage(maxQty: number): string {
  return `Only ${maxQty.toLocaleString()} available`;
}

export type CartLineForReplace = {
  productId?: string;
  name: string;
  qty: number;
};

export function findDraftCartLine<T extends { productId?: string; name: string }>(
  lines: readonly T[],
  productId: string,
  name: string,
): T | undefined {
  return (
    lines.find((line) => line.productId === productId) ??
    lines.find((line) => line.name === name)
  );
}

export function replaceDraftLineQty(
  lines: readonly CartLineForReplace[],
  productId: string,
  qty: number,
  name: string,
): Array<{ productId: string; qty: number }> | null {
  const next: Array<{ productId: string; qty: number }> = [];
  let found = false;
  for (const line of lines) {
    const isTarget = !found && (line.productId === productId || line.name === name);
    if (isTarget) {
      found = true;
      if (qty > 0) {
        next.push({ productId, qty });
      }
      continue;
    }
    if (line.productId === undefined) {
      return null;
    }
    next.push({ productId: line.productId, qty: line.qty });
  }
  if (!found && qty > 0) {
    next.push({ productId, qty });
  }
  return next;
}

export type DraftCartLine = CartLineForReplace & {
  id?: string;
  sku: string;
};

export function mapDraftLineQty<T extends DraftCartLine>(
  lines: readonly T[],
  lineId: string,
  qty: number,
): T[] {
  return lines.map((item) => (item.id === lineId ? { ...item, qty } : item));
}

export async function toReplaceLines(
  lines: readonly DraftCartLine[],
  lookupProductId: (sku: string, name: string) => Promise<string | null>,
): Promise<Array<{ productId: string; qty: number }> | null> {
  const synced = linesForReplace(lines);
  if (synced !== null) {
    return synced;
  }
  const next: Array<{ productId: string; qty: number }> = [];
  for (const line of lines) {
    const productId =
      line.productId ?? (await lookupProductId(line.sku, line.name));
    if (productId === null) {
      return null;
    }
    next.push({ productId, qty: line.qty });
  }
  return next;
}

/** Sync path when every line already carries productId (normal cart flow). */
export function linesForReplace(
  lines: readonly DraftCartLine[],
): Array<{ productId: string; qty: number }> | null {
  const next: Array<{ productId: string; qty: number }> = [];
  for (const line of lines) {
    if (line.productId === undefined) {
      return null;
    }
    next.push({ productId: line.productId, qty: line.qty });
  }
  return next;
}

export function remainingDraftLines(
  lines: readonly DraftCartLine[],
  lineId: string,
): DraftCartLine[] {
  return lines.filter((line) => line.id !== lineId);
}
