import { describe, expect, it } from "vitest";
import {
  CurrencyMismatchError,
  InvalidMoneyError,
  Money,
  majorUnitExponent,
} from "../src/index.js";

describe("Money construction", () => {
  it("accepts integer minor units and an ISO currency", () => {
    const money = Money.fromMinorUnits(1999, "usd");
    expect(money.amountMinor).toBe(1999);
    expect(money.currency).toBe("USD");
  });

  it("accepts zero and negative minor units (credits)", () => {
    expect(Money.fromMinorUnits(0, "USD").amountMinor).toBe(0);
    expect(Money.fromMinorUnits(-250, "USD").amountMinor).toBe(-250);
  });

  it("rejects non-integer minor units", () => {
    expect(() => Money.fromMinorUnits(10.5, "USD")).toThrow(InvalidMoneyError);
    expect(() => Money.fromMinorUnits(Number.NaN, "USD")).toThrow(
      InvalidMoneyError,
    );
    expect(() => Money.fromMinorUnits(Number.POSITIVE_INFINITY, "USD")).toThrow(
      InvalidMoneyError,
    );
  });

  it("rejects a currency that is not a 3-letter ISO code", () => {
    expect(() => Money.fromMinorUnits(1, "US")).toThrow(InvalidMoneyError);
    expect(() => Money.fromMinorUnits(1, "USDD")).toThrow(InvalidMoneyError);
    expect(() => Money.fromMinorUnits(1, "us1")).toThrow(InvalidMoneyError);
    expect(() => Money.fromMinorUnits(1, "")).toThrow(InvalidMoneyError);
  });

  it("is immutable", () => {
    const money = Money.fromMinorUnits(100, "USD");
    expect(Object.isFrozen(money)).toBe(true);
  });
});

describe("Money major-unit scale", () => {
  it("uses the currency exponent instead of a hardcoded /100", () => {
    expect(majorUnitExponent("USD")).toBe(2);
    expect(majorUnitExponent("JPY")).toBe(0);
    expect(majorUnitExponent("BHD")).toBe(3);
  });

  it("converts integer major units using the currency exponent", () => {
    expect(Money.fromMajorUnits(10, "USD").amountMinor).toBe(1000);
    expect(Money.fromMajorUnits(10, "JPY").amountMinor).toBe(10);
    expect(Money.fromMajorUnits(1, "BHD").amountMinor).toBe(1000);
  });

  it("rejects non-integer major units (no float money)", () => {
    expect(() => Money.fromMajorUnits(10.5, "USD")).toThrow(InvalidMoneyError);
  });

  it("rejects major-unit conversion for an unknown currency exponent", () => {
    expect(() => Money.fromMajorUnits(1, "XXX")).toThrow(InvalidMoneyError);
    expect(() => majorUnitExponent("XXX")).toThrow(InvalidMoneyError);
  });

  it("round-trips major units through the currency exponent", () => {
    expect(Money.fromMajorUnits(10, "USD").toMajorUnits()).toBe(10);
    expect(Money.fromMajorUnits(10, "JPY").toMajorUnits()).toBe(10);
  });
});

describe("Money arithmetic", () => {
  it("adds and subtracts the same currency", () => {
    const a = Money.fromMinorUnits(100, "USD");
    const b = Money.fromMinorUnits(40, "USD");
    expect(a.add(b).amountMinor).toBe(140);
    expect(a.subtract(b).amountMinor).toBe(60);
  });

  it("refuses mixed-currency arithmetic (no FX in v1)", () => {
    const usd = Money.fromMinorUnits(100, "USD");
    const eur = Money.fromMinorUnits(100, "EUR");
    expect(() => usd.add(eur)).toThrow(CurrencyMismatchError);
    expect(() => usd.subtract(eur)).toThrow(CurrencyMismatchError);
    expect(() => usd.compare(eur)).toThrow(CurrencyMismatchError);
    expect(() => usd.add(eur)).toThrow(
      /Mixed-currency arithmetic is not supported in v1/,
    );
  });

  it("multiplies by an integer quantity", () => {
    const unit = Money.fromMinorUnits(250, "USD");
    expect(unit.multiply(3).amountMinor).toBe(750);
    expect(unit.multiply(0).amountMinor).toBe(0);
    expect(unit.multiply(-1).amountMinor).toBe(-250);
  });

  it("rejects a non-integer multiplier", () => {
    expect(() => Money.fromMinorUnits(100, "USD").multiply(1.5)).toThrow(
      InvalidMoneyError,
    );
  });

  it("compares and equals within one currency", () => {
    const a = Money.fromMinorUnits(100, "USD");
    const b = Money.fromMinorUnits(100, "USD");
    const c = Money.fromMinorUnits(101, "USD");
    expect(a.equals(b)).toBe(true);
    expect(a.equals(c)).toBe(false);
    expect(a.equals(Money.fromMinorUnits(100, "EUR"))).toBe(false);
    expect(a.compare(c)).toBe(-1);
    expect(c.compare(a)).toBe(1);
    expect(a.compare(b)).toBe(0);
  });
});
