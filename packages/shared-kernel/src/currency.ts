import { InvalidMoneyError } from "./errors.js";

const ISO_4217 = /^[A-Z]{3}$/;

/**
 * ISO 4217 minor-unit exponents. Conversion must use this table —
 * never a hardcoded `/100`.
 */
const MAJOR_UNIT_EXPONENTS: Readonly<Record<string, number>> = {
  BHD: 3,
  JOD: 3,
  KWD: 3,
  OMR: 3,
  TND: 3,
  AED: 2,
  AUD: 2,
  BRL: 2,
  CAD: 2,
  CHF: 2,
  CNY: 2,
  DKK: 2,
  EUR: 2,
  GBP: 2,
  HKD: 2,
  INR: 2,
  MXN: 2,
  NOK: 2,
  NZD: 2,
  PLN: 2,
  SEK: 2,
  SGD: 2,
  USD: 2,
  ZAR: 2,
  ISK: 0,
  JPY: 0,
  KRW: 0,
  VND: 0,
};

export function normalizeCurrency(currency: string): string {
  const code = currency.trim().toUpperCase();
  if (!ISO_4217.test(code)) {
    throw new InvalidMoneyError(
      `Currency must be a 3-letter ISO 4217 code, got ${JSON.stringify(currency)}`,
    );
  }
  return code;
}

export function majorUnitExponent(currency: string): number {
  const code = normalizeCurrency(currency);
  const exponent = MAJOR_UNIT_EXPONENTS[code];
  if (exponent === undefined) {
    throw new InvalidMoneyError(
      `No major-unit exponent registered for ${code}. Use fromMinorUnits or add the ISO exponent.`,
    );
  }
  return exponent;
}
