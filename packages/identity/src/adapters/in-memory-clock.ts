import type { IClock } from "../domain/clock.js";

/** Mutable clock for idle/absolute TTL tests. */
export class InMemoryClock implements IClock {
  constructor(private instant: Date) {}

  now(): Date {
    return this.instant;
  }

  advance(ms: number): void {
    this.instant = new Date(this.instant.getTime() + ms);
  }
}
