import type { IClock } from "../domain/clock.js";

/** Mutable clock so seed playback can pin document creation time. */
export class InMemoryClock implements IClock {
  constructor(private instant: Date) {}

  now(): Date {
    return this.instant;
  }

  advance(ms: number): void {
    this.instant = new Date(this.instant.getTime() + ms);
  }

  setInstant(instant: Date): void {
    this.instant = instant;
  }
}
