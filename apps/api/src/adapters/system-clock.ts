import type { IClock } from "../domain/clock.js";

/** Production clock adapter. Wired only at the composition root. */
export class SystemClock implements IClock {
  now(): Date {
    return new Date();
  }
}
