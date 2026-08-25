/** Driven port: sales-order writes ask for "now" without knowing the clock source. */
export interface IClock {
  now(): Date;
}
