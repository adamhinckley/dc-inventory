export type SeededRandom = {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
  bool(probability?: number): boolean;
};

function hashSeedString(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Mulberry32 PRNG. Never uses Math.random(). */
export function createSeededRandom(seed: string): SeededRandom {
  let state = hashSeedString(seed);

  const next = (): number => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };

  return {
    next,
    int(min: number, max: number): number {
      if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
        throw new Error(`invalid int range ${String(min)}..${String(max)}`);
      }
      return min + Math.floor(next() * (max - min + 1));
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) {
        throw new Error("cannot pick from an empty list");
      }
      const item = items[this.int(0, items.length - 1)];
      if (item === undefined) {
        throw new Error("pick returned undefined");
      }
      return item;
    },
    shuffle<T>(items: readonly T[]): T[] {
      const copy = [...items];
      for (let index = copy.length - 1; index > 0; index -= 1) {
        const swapIndex = this.int(0, index);
        const current = copy[index];
        const swap = copy[swapIndex];
        if (current === undefined || swap === undefined) {
          throw new Error("shuffle encountered undefined");
        }
        copy[index] = swap;
        copy[swapIndex] = current;
      }
      return copy;
    },
    bool(probability = 0.5): boolean {
      return next() < probability;
    },
  };
}
