import { majorUnitExponent, normalizeCurrency } from "./currency.js";
import { CurrencyMismatchError, InvalidMoneyError } from "./errors.js";

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new InvalidMoneyError(
      `${label} must be a finite safe integer, got ${String(value)}`,
    );
  }
}

/**
 * Integer minor units + ISO currency. Invalid values cannot be constructed.
 * Arithmetic across currencies is rejected (no FX in v1).
 */
export class Money {
  readonly amountMinor: number;
  readonly currency: string;

  private constructor(amountMinor: number, currency: string) {
    this.amountMinor = amountMinor;
    this.currency = currency;
    Object.freeze(this);
  }

  static fromMinorUnits(amountMinor: number, currency: string): Money {
    assertSafeInteger(amountMinor, "amountMinor");
    return new Money(amountMinor, normalizeCurrency(currency));
  }

  static fromMajorUnits(amountMajor: number, currency: string): Money {
    assertSafeInteger(amountMajor, "amountMajor");
    const code = normalizeCurrency(currency);
    const factor = 10 ** majorUnitExponent(code);
    const minor = amountMajor * factor;
    if (!Number.isSafeInteger(minor)) {
      throw new InvalidMoneyError(
        `fromMajorUnits overflowed the safe integer range for ${amountMajor} ${code}`,
      );
    }
    return new Money(minor, code);
  }

  static zero(currency: string): Money {
    return Money.fromMinorUnits(0, currency);
  }

  toMajorUnits(): number {
    const factor = 10 ** majorUnitExponent(this.currency);
    return this.amountMinor / factor;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromMinorUnits(this.amountMinor + other.amountMinor, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromMinorUnits(this.amountMinor - other.amountMinor, this.currency);
  }

  multiply(quantity: number): Money {
    assertSafeInteger(quantity, "quantity");
    const product = this.amountMinor * quantity;
    if (!Number.isSafeInteger(product)) {
      throw new InvalidMoneyError("multiply overflowed the safe integer range");
    }
    return Money.fromMinorUnits(product, this.currency);
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amountMinor === other.amountMinor;
  }

  compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    if (this.amountMinor < other.amountMinor) return -1;
    if (this.amountMinor > other.amountMinor) return 1;
    return 0;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }
}
