/** Driven port: the use case asks for "now" without knowing the clock source. */
export interface IClock {
  now(): Date;
}
