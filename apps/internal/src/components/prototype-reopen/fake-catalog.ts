/** PROTOTYPE — throwaway in-memory catalog (~60 rows standing in for 2,500). */

export type FakeSku = {
  sku: string;
  name: string;
  season: "spring" | "fall" | "yearRound";
  sellState: "open" | "locked";
  /** Pending ADA-219 — year-round items we must not reopen by accident. */
  neverOpen: boolean;
  isNewThisPresell: boolean;
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

function pad(n: number): string {
  return String(n).padStart(3, "0");
}

export const FAKE_SKUS: FakeSku[] = [
  ...SPRING.flatMap((word, i) =>
    [1, 2, 3].map((n) => ({
      sku: `DC-SP-${pad(i * 3 + n)}`,
      name: `${word} ${n}`,
      season: "spring" as const,
      sellState: n === 1 ? ("open" as const) : ("locked" as const),
      neverOpen: false,
      isNewThisPresell: n === 3,
    })),
  ),
  ...FALL.flatMap((word, i) =>
    [1, 2, 3].map((n) => ({
      sku: `DC-FA-${pad(i * 3 + n)}`,
      name: `${word} ${n}`,
      season: "fall" as const,
      sellState: "locked" as const,
      neverOpen: false,
      isNewThisPresell: n === 1 && i < 2,
    })),
  ),
  ...YEAR.map((word, i) => ({
    sku: `DC-YR-${pad(i + 1)}`,
    name: `${word} Everyday`,
    season: "yearRound" as const,
    sellState: "locked" as const,
    neverOpen: true,
    isNewThisPresell: false,
  })),
];

export type CatalogFilter = {
  q: string;
  season: "all" | FakeSku["season"];
  sellState: "all" | FakeSku["sellState"];
  newOnly: boolean;
  excludeNeverOpen: boolean;
};

export function matchFakeSkus(filter: CatalogFilter): FakeSku[] {
  const q = filter.q.trim().toLowerCase();
  return FAKE_SKUS.filter((row) => {
    if (filter.excludeNeverOpen && row.neverOpen) {
      return false;
    }
    if (filter.season !== "all" && row.season !== filter.season) {
      return false;
    }
    if (filter.sellState !== "all" && row.sellState !== filter.sellState) {
      return false;
    }
    if (filter.newOnly && !row.isNewThisPresell) {
      return false;
    }
    if (q.length > 0 && !`${row.sku} ${row.name}`.toLowerCase().includes(q)) {
      return false;
    }
    return true;
  });
}

export const SAVED_LISTS = [
  {
    id: "spring-2027",
    name: "Spring 2027",
    skus: FAKE_SKUS.filter((row) => row.season === "spring").map((row) => row.sku),
  },
  {
    id: "new-presell",
    name: "New This Pre-Sell",
    skus: FAKE_SKUS.filter((row) => row.isNewThisPresell).map((row) => row.sku),
  },
  {
    id: "year-round-trap",
    name: "Ops Paste (includes year-round)",
    skus: [
      ...FAKE_SKUS.filter((row) => row.season === "fall")
        .slice(0, 8)
        .map((row) => row.sku),
      ...FAKE_SKUS.filter((row) => row.neverOpen).map((row) => row.sku),
    ],
  },
] as const;
