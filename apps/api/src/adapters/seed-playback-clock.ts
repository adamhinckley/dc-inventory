import type { IClock } from "../domain/clock.js";

/** Mutable clock for demo seed playback through Postgres composition. */
export class SeedPlaybackClock implements IClock {
  constructor(private instant: Date) {}

  now(): Date {
    return this.instant;
  }

  setInstant(instant: Date): void {
    this.instant = instant;
  }
}
