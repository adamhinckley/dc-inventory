/** Driven port: session TTL asks for "now" without knowing the clock source. */
export interface IClock {
  now(): Date;
}
