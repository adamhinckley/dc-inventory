/** PROTOTYPE — throwaway in-memory catalog at catalog scale (~2,500). */

export const FACTORIES = ["Ningbo Home", "Yiwu Seasonal", "Midwest Basics"] as const;
export type FactoryName = (typeof FACTORIES)[number];

export const CATEGORIES = [
  "Spring Outdoor",
  "Fall Harvest",
  "Everyday Home",
] as const;
export type CategoryName = (typeof CATEGORIES)[number];

export type FakeSku = {
  sku: string;
  name: string;
  factory: FactoryName;
  category: CategoryName;
  sellState: "open" | "locked";
  neverOpen: boolean;
  isNewThisPresell: boolean;
  active: boolean;
  discontinued: boolean;
  webWholesale: boolean;
  onHand: number;
  onOrder: number;
  windowOpensAt: string | null;
  windowClosesAt: string | null;
};

const SPRING = [
  "Lantern",
  "Wreath",
  "Bunny",
  "Tulip",
  "Birdhouse",
  "Planter",
  "Egg",
  "Ribbon",
];
const FALL = [
  "Pumpkin",
  "Scarecrow",
  "Leaf",
  "Harvest",
  "Owl",
  "Corn",
  "Acorn",
  "Plaid",
];
const YEAR = ["Mug", "Frame", "Candle", "Tray", "Sign", "Basket"];
const CATALOG_SIZE = 2500;

function pad(n: number, width = 3): string {
  return String(n).padStart(width, "0");
}

const SEED: FakeSku[] = [
  ...SPRING.flatMap((word, i) =>
    [1, 2, 3].map((n) => ({
      sku: `DC-SP-${pad(i * 3 + n)}`,
      name: `${word} ${n}`,
      factory: (i % 2 === 0 ? "Ningbo Home" : "Yiwu Seasonal") as FactoryName,
      category: "Spring Outdoor" as const,
      sellState: n === 1 ? ("open" as const) : ("locked" as const),
      neverOpen: false,
      isNewThisPresell: n === 3,
      active: n !== 1 || i > 0,
      discontinued: n === 1 && i === 0,
      webWholesale: n !== 1 || i > 1,
      onHand: n === 2 ? 40 : 0,
      onOrder: n === 3 ? 200 : 0,
      windowOpensAt: n === 2 ? "2026-12-01" : null,
      windowClosesAt: n === 2 ? "2027-02-15" : null,
    })),
  ),
  ...FALL.flatMap((word, i) =>
    [1, 2, 3].map((n) => ({
      sku: `DC-FA-${pad(i * 3 + n)}`,
      name: `${word} ${n}`,
      factory: (i % 2 === 0 ? "Yiwu Seasonal" : "Ningbo Home") as FactoryName,
      category: "Fall Harvest" as const,
      sellState: "locked" as const,
      neverOpen: false,
      isNewThisPresell: n === 1 && i < 2,
      active: true,
      discontinued: false,
      webWholesale: true,
      onHand: n === 1 ? 12 : 0,
      onOrder: n === 2 ? 80 : 0,
      windowOpensAt: null,
      windowClosesAt: null,
    })),
  ),
  ...YEAR.map((word, i) => ({
    sku: `DC-YR-${pad(i + 1)}`,
    name: `${word} Everyday`,
    factory: "Midwest Basics" as const,
    category: "Everyday Home" as const,
    sellState: "locked" as const,
    neverOpen: true,
    isNewThisPresell: false,
    active: true,
    discontinued: i === 5,
    webWholesale: i < 5,
    onHand: 8,
    onOrder: 0,
    windowOpensAt: null,
    windowClosesAt: null,
  })),
];

const WORDS = [...SPRING, ...FALL, ...YEAR];

function extraRow(index: number): FakeSku {
  const category = CATEGORIES[index % CATEGORIES.length]!;
  const factory = FACTORIES[index % FACTORIES.length]!;
  const word = WORDS[index % WORDS.length]!;
  const neverOpen = category === "Everyday Home" && index % 40 === 0;
  return {
    sku: `DC-GX-${pad(index, 4)}`,
    name: `${word} ${100 + (index % 90)}`,
    factory,
    category,
    sellState: index % 5 === 0 ? "open" : "locked",
    neverOpen,
    isNewThisPresell: !neverOpen && index % 25 === 0,
    active: index % 30 !== 0,
    discontinued: index % 80 === 0,
    webWholesale: index % 11 !== 0,
    onHand: index % 7 === 0 ? 24 : 0,
    onOrder: index % 9 === 0 ? 120 : 0,
    windowOpensAt: index % 18 === 0 ? "2026-12-01" : null,
    windowClosesAt: index % 18 === 0 ? "2027-02-15" : null,
  };
}

export const FAKE_SKUS: FakeSku[] = [
  ...SEED,
  ...Array.from({ length: CATALOG_SIZE - SEED.length }, (_, i) => extraRow(i)),
];
