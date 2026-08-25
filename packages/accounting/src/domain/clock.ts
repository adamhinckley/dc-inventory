/** Driven port: invoice, payment, and application writes ask for "now" without knowing the clock source. */
export interface IClock {
  now(): Date;
}
