import type { IClock } from "../domain/clock.js";

/** Fixed clock for unit tests — no system time, no network. */
export class InMemoryClock implements IClock {
  constructor(private readonly instant: Date) {}

  now(): Date {
    return this.instant;
  }
}
