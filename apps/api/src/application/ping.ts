import type { IClock } from "../domain/clock.js";

export type PingResult = {
  ok: true;
  at: Date;
};

/**
 * Golden-path use case: no HTTP, no logger, no I/O beyond the clock port.
 * Later contexts copy this shape (port in domain/, use case here, adapter outside).
 */
export class PingUseCase {
  constructor(private readonly clock: IClock) {}

  execute(): PingResult {
    return { ok: true, at: this.clock.now() };
  }
}
