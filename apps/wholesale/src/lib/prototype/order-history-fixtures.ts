import { isVisibleOrderStatus, type VisibleOrderStatus } from "../order-history";

export type PrototypeOrderLine = {
  id: string;
  name: string;
  sku: string;
  qty: number;
  unitPriceCents: number;
  currency: "USD";
};

export type PrototypeOrder = {
  documentNumber: string;
  status: VisibleOrderStatus;
  placedOn: string;
  shipLine1: string;
  shipCity: string;
  shipRegion: string;
  shipPostal: string;
  shipCountry: string;
  lines: readonly PrototypeOrderLine[];
};

export const PROTOTYPE_ORDER_VARIANTS = ["a", "b", "c"] as const;
export type PrototypeOrderVariant = (typeof PROTOTYPE_ORDER_VARIANTS)[number];

export function isPrototypeOrderVariant(value: string): value is PrototypeOrderVariant {
  return (PROTOTYPE_ORDER_VARIANTS as readonly string[]).includes(value);
}

export const PROTOTYPE_ORDERS: readonly PrototypeOrder[] = [
  {
    documentNumber: "SO-00042",
    status: "confirmed",
    placedOn: "Sep 8, 2026",
    shipLine1: "200 Ship St",
    shipCity: "Seattle",
    shipRegion: "WA",
    shipPostal: "98101",
    shipCountry: "US",
    lines: [
      {
        id: "line-42-1",
        name: "Harvest Pumpkin Trio",
        sku: "PUMP-TRIO",
        qty: 12,
        unitPriceCents: 1850,
        currency: "USD",
      },
      {
        id: "line-42-2",
        name: "Amber Glass Hurricane",
        sku: "HURR-AMB",
        qty: 6,
        unitPriceCents: 2400,
        currency: "USD",
      },
    ],
  },
  {
    documentNumber: "SO-00038",
    status: "shipped",
    placedOn: "Aug 22, 2026",
    shipLine1: "14 Market Row",
    shipCity: "Portland",
    shipRegion: "OR",
    shipPostal: "97201",
    shipCountry: "US",
    lines: [
      {
        id: "line-38-1",
        name: "Linen Table Runner",
        sku: "LIN-RUN-90",
        qty: 24,
        unitPriceCents: 1600,
        currency: "USD",
      },
    ],
  },
  {
    documentNumber: "SO-00031",
    status: "cancelled",
    placedOn: "Jul 14, 2026",
    shipLine1: "88 Pine Ave",
    shipCity: "Boise",
    shipRegion: "ID",
    shipPostal: "83702",
    shipCountry: "US",
    lines: [
      {
        id: "line-31-1",
        name: "Ceramic Compote",
        sku: "CER-COM-LG",
        qty: 4,
        unitPriceCents: 3200,
        currency: "USD",
      },
      {
        id: "line-31-2",
        name: "Dried Eucalyptus Bundle",
        sku: "EUC-BND",
        qty: 10,
        unitPriceCents: 900,
        currency: "USD",
      },
    ],
  },
];

export const PROTOTYPE_VARIANT_COPY: Record<
  PrototypeOrderVariant,
  { title: string; blurb: string }
> = {
  a: {
    title: "A · Compact",
    blurb: "What is shipping: a simple row list and a stacked detail page.",
  },
  b: {
    title: "B · Cards",
    blurb: "Status chips and a card grid. Detail reads like a receipt with a short timeline.",
  },
  c: {
    title: "C · Split",
    blurb: "History and detail on one page. Click a row; the pane updates.",
  },
};

export function findPrototypeOrder(documentNumber: string): PrototypeOrder | undefined {
  return PROTOTYPE_ORDERS.find((order) => order.documentNumber === documentNumber);
}

export function prototypeOrdersPath(variant?: PrototypeOrderVariant): string {
  if (variant === undefined) {
    return "/orders/prototype";
  }
  return `/orders/prototype/${variant}`;
}

export function prototypeOrderPath(
  variant: PrototypeOrderVariant,
  documentNumber: string,
): string {
  return `/orders/prototype/${variant}/${encodeURIComponent(documentNumber)}`;
}

export function assertPrototypeOrdersAreHistoryOnly(
  orders: readonly PrototypeOrder[],
): boolean {
  return orders.every((order) => isVisibleOrderStatus(order.status));
}
