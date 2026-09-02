/** PROTOTYPE — in-memory Receiving fixture. Not production. */

export type PrototypeHistoryRow = {
  at: string;
  sku: string;
  qty: number;
};

export type PrototypeLine = {
  id: string;
  sku: string;
  name: string;
  ordered: number;
  received: number;
  receiveQty: number;
};

export type PrototypeInboundPo = {
  id: string;
  documentNumber: string;
  supplier: string;
  shipDate: string;
  remaining: number;
  inboundOpen: boolean;
  lines: PrototypeLine[];
  history: PrototypeHistoryRow[];
};

export function isOnInboundList(po: PrototypeInboundPo): boolean {
  return po.inboundOpen && po.remaining > 0;
}

export type PrototypeShortNotice = {
  uncoveredBySku: { sku: string; uncovered: number }[];
  affectedCustomers: string[];
};

function remaining(line: PrototypeLine): number {
  return Math.max(0, line.ordered - line.received);
}

function remainingOf(po: PrototypeInboundPo): number {
  return po.lines.reduce((sum, line) => sum + remaining(line), 0);
}

function withReceiveQty(po: PrototypeInboundPo): PrototypeInboundPo {
  return {
    ...po,
    remaining: po.inboundOpen === false ? 0 : remainingOf(po),
    inboundOpen: po.inboundOpen !== false,
    lines: po.lines.map((line) => ({ ...line, receiveQty: remaining(line) })),
  };
}

const SEED: PrototypeInboundPo[] = [
  withReceiveQty({
    id: "po-1042",
    documentNumber: "PO-1042",
    supplier: "Acme Factory",
    shipDate: "2026-09-03",
    remaining: 0,
    history: [
      { at: "2026-09-01 09:12", sku: "BOLT-M8", qty: 40 },
    ],
    lines: [
      {
        id: "l1",
        sku: "BOLT-M8",
        name: "Hex bolt M8",
        ordered: 100,
        received: 40,
        receiveQty: 0,
      },
      {
        id: "l2",
        sku: "NUT-M8",
        name: "Hex nut M8",
        ordered: 100,
        received: 0,
        receiveQty: 0,
      },
      {
        id: "l4",
        sku: "WASHER-M8",
        name: "Flat washer M8",
        ordered: 200,
        received: 200,
        receiveQty: 0,
      },
      {
        id: "l5",
        sku: "CAP-SCREW-10",
        name: "Cap screw 10mm",
        ordered: 48,
        received: 0,
        receiveQty: 0,
      },
      {
        id: "l6",
        sku: "GASKET-A",
        name: "Lid gasket A",
        ordered: 12,
        received: 4,
        receiveQty: 0,
      },
      {
        id: "l7",
        sku: "HOSE-3/8",
        name: "Fuel hose 3/8",
        ordered: 30,
        received: 0,
        receiveQty: 0,
      },
    ],
  }),
  withReceiveQty({
    id: "po-1048",
    documentNumber: "PO-1048",
    supplier: "Northwind Metals",
    shipDate: "2026-09-08",
    remaining: 0,
    history: [],
    lines: [
      {
        id: "l3",
        sku: "PLATE-12",
        name: "Steel plate 12ga",
        ordered: 20,
        received: 0,
        receiveQty: 0,
      },
    ],
  }),
];

export function cloneSeed(): PrototypeInboundPo[] {
  return structuredClone(SEED);
}

export function setLineReceiveQty(
  inbound: PrototypeInboundPo[],
  poId: string,
  lineId: string,
  qty: number,
): PrototypeInboundPo[] {
  return inbound.map((po) => {
    if (po.id !== poId) return po;
    return {
      ...po,
      lines: po.lines.map((line) =>
        line.id === lineId
          ? { ...line, receiveQty: Math.max(0, Math.min(qty, remaining(line))) }
          : line,
      ),
    };
  });
}

export function receiveLines(
  inbound: PrototypeInboundPo[],
  poId: string,
): PrototypeInboundPo[] {
  const now = "2026-09-01 16:40";
  return inbound
    .map((po) => {
      if (po.id !== poId) return po;
      const history = [...po.history];
      const lines = po.lines.map((line) => {
        const qty = Math.min(line.receiveQty, remaining(line));
        if (qty <= 0) return line;
        history.push({ at: now, sku: line.sku, qty });
        const received = line.received + qty;
        return { ...line, received, receiveQty: line.ordered - received };
      });
      return withReceiveQty({ ...po, lines, history });
    });
}

export function closeShort(
  inbound: PrototypeInboundPo[],
  poId: string,
): { inbound: PrototypeInboundPo[]; notice: PrototypeShortNotice } {
  const po = inbound.find((row) => row.id === poId);
  const remainingSkus =
    po?.lines
      .filter((line) => remaining(line) > 0)
      .map((line) => ({ sku: line.sku, uncovered: remaining(line) })) ?? [];
  const notice: PrototypeShortNotice = {
    uncoveredBySku: remainingSkus,
    affectedCustomers:
      remainingSkus.length > 0
        ? ["Idle Park Wholesale", "Cedar Supply Co."]
        : [],
  };
  return {
    inbound: inbound.map((row) =>
      row.id === poId ? withReceiveQty({ ...row, inboundOpen: false }) : row,
    ),
    notice,
  };
}
