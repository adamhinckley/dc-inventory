import type { SeededRandom } from "./seeded-random.js";

export function mean(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Uniform integer range whose inclusive mean equals the target mean. */
export function sampleUniformIntRange(rng: SeededRandom, min: number, max: number): number {
  return rng.int(min, max);
}

/**
 * Build `count` integers in [min,max] whose arithmetic mean is exactly `targetMean`.
 * Uses deterministic remainder distribution via the seeded source.
 */
export function buildCorpusIntegers(
  rng: SeededRandom,
  count: number,
  min: number,
  max: number,
  targetMean: number,
): number[] {
  if (count <= 0) {
    return [];
  }
  if (targetMean < min || targetMean > max) {
    throw new Error(`target mean ${String(targetMean)} outside ${String(min)}..${String(max)}`);
  }

  const base = Math.floor(targetMean);
  const values = Array.from({ length: count }, () =>
    Math.min(max, Math.max(min, base)),
  );
  let sum = values.reduce((left, right) => left + right, 0);
  const targetSum = Math.round(targetMean * count);

  const indices = rng.shuffle(Array.from({ length: count }, (_, index) => index));
  let cursor = 0;
  while (sum < targetSum) {
    const index = indices[cursor % indices.length];
    if (index === undefined) {
      throw new Error("corpus sampler index missing");
    }
    if (values[index]! < max) {
      values[index]! += 1;
      sum += 1;
    }
    cursor += 1;
    if (cursor > count * (max - min + 1) * 2 && sum < targetSum) {
      throw new Error("unable to reach target corpus mean");
    }
  }
  while (sum > targetSum) {
    const index = indices[cursor % indices.length];
    if (index === undefined) {
      throw new Error("corpus sampler index missing");
    }
    if (values[index]! > min) {
      values[index]! -= 1;
      sum -= 1;
    }
    cursor += 1;
    if (cursor > count * (max - min + 1) * 2 && sum > targetSum) {
      throw new Error("unable to reach target corpus mean");
    }
  }

  return values;
}

export function pickDistinct<T>(
  rng: SeededRandom,
  pool: readonly T[],
  count: number,
): T[] {
  if (count > pool.length) {
    throw new Error(`need ${String(count)} distinct values but pool has ${String(pool.length)}`);
  }
  return rng.shuffle(pool).slice(0, count);
}

export function allocateExactCounts(
  rng: SeededRandom,
  keys: readonly string[],
  total: number,
): Map<string, number> {
  if (keys.length === 0) {
    throw new Error("cannot allocate counts to zero keys");
  }
  const counts = new Map<string, number>(keys.map((key) => [key, 0]));
  for (let index = 0; index < total; index += 1) {
    const key = rng.pick(keys);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
