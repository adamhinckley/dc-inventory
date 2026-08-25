import {
  BASE_MONTH_WEIGHT,
  DEMO_HISTORY_YEARS,
  Q4_MONTH_WEIGHT,
} from "./constants.js";
import type { SeededRandom } from "./seeded-random.js";

const MS_PER_DAY = 86_400_000;
const WEIGHT_SCALE = 10;

type HistoricalSampleOptions = {
  q4Only?: boolean;
  excludeLastDays?: number;
  seedToday?: Date;
};

const weightedOffsetCache = new Map<string, readonly number[]>();

export function clearHistoricalInstantCache(): void {
  weightedOffsetCache.clear();
}

export function utcStartOfDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

export function addUtcYears(date: Date, years: number): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear() + years,
      date.getUTCMonth(),
      date.getUTCDate(),
    ),
  );
}

export function demoHistoricalStart(seedToday: Date): Date {
  return addUtcYears(utcStartOfDay(seedToday), -DEMO_HISTORY_YEARS);
}

export function daysBetween(start: Date, end: Date): number {
  const from = utcStartOfDay(start).getTime();
  const to = utcStartOfDay(end).getTime();
  return Math.trunc((to - from) / MS_PER_DAY);
}

export function monthWeight(monthIndex: number): number {
  return monthIndex >= 9 && monthIndex <= 11 ? Q4_MONTH_WEIGHT : BASE_MONTH_WEIGHT;
}

function cacheKey(
  startDay: Date,
  endDay: Date,
  options: HistoricalSampleOptions | undefined,
): string {
  const excludeLastDays = options?.excludeLastDays ?? 0;
  const seedToday = options?.seedToday ?? endDay;
  return [
    startDay.getTime(),
    endDay.getTime(),
    options?.q4Only ? "q4" : "all",
    excludeLastDays,
    seedToday.getTime(),
  ].join("|");
}

function buildWeightedOffsets(
  startDay: Date,
  totalDays: number,
  latestAllowed: Date,
  q4Only: boolean,
): readonly number[] {
  const weightedDays: number[] = [];
  for (let offset = 0; offset <= totalDays; offset += 1) {
    const day = addUtcDays(startDay, offset);
    if (day.getTime() > utcStartOfDay(latestAllowed).getTime()) {
      continue;
    }
    const month = day.getUTCMonth();
    if (q4Only && !(month >= 9 && month <= 11)) {
      continue;
    }
    const repeat = Math.round(monthWeight(month) * WEIGHT_SCALE);
    for (let index = 0; index < repeat; index += 1) {
      weightedDays.push(offset);
    }
  }
  if (weightedDays.length === 0) {
    throw new Error("historical sampler produced no eligible days");
  }
  return weightedDays;
}

export function sampleHistoricalInstant(
  rng: SeededRandom,
  startInclusive: Date,
  endInclusive: Date,
  options?: HistoricalSampleOptions,
): Date {
  const startDay = utcStartOfDay(startInclusive);
  const endDay = utcStartOfDay(endInclusive);
  const totalDays = daysBetween(startDay, endDay);
  if (totalDays < 0) {
    throw new Error("historical window end precedes start");
  }

  const excludeLastDays = options?.excludeLastDays ?? 0;
  const seedToday = options?.seedToday ?? endInclusive;
  const latestAllowed = addUtcDays(seedToday, -excludeLastDays);
  const key = cacheKey(startDay, endDay, options);
  let weightedDays = weightedOffsetCache.get(key);
  if (!weightedDays) {
    weightedDays = buildWeightedOffsets(
      startDay,
      totalDays,
      latestAllowed,
      options?.q4Only ?? false,
    );
    weightedOffsetCache.set(key, weightedDays);
  }

  const pickedOffset = rng.pick(weightedDays);
  return addUtcDays(startDay, pickedOffset);
}

export function sampleLeftoverInstant(rng: SeededRandom, seedToday: Date, windowDays: number): Date {
  const end = utcStartOfDay(seedToday);
  const start = addUtcDays(end, -(windowDays - 1));
  const offset = rng.int(0, daysBetween(start, end));
  return addUtcDays(start, offset);
}

export function isWithinLastDays(instant: Date, seedToday: Date, days: number): boolean {
  const age = daysBetween(instant, seedToday);
  return age >= 0 && age <= days - 1;
}

export function utcMonth(instant: Date): number {
  return instant.getUTCMonth();
}

export function isQ4Month(instant: Date): boolean {
  const month = utcMonth(instant);
  return month >= 9 && month <= 11;
}

export function expectedQ4Fraction(): number {
  const q4Weight = Q4_MONTH_WEIGHT * 3;
  const baseWeight = BASE_MONTH_WEIGHT * 9;
  return q4Weight / (q4Weight + baseWeight);
}
