export class InvalidMoneyError extends Error {
  override readonly name = "InvalidMoneyError";

  constructor(message: string) {
    super(message);
  }
}

export class CurrencyMismatchError extends Error {
  override readonly name = "CurrencyMismatchError";

  constructor(left: string, right: string) {
    super(
      `Currency mismatch: ${left} vs ${right}. Mixed-currency arithmetic is not supported in v1.`,
    );
  }
}

export class InvalidSkuError extends Error {
  override readonly name = "InvalidSkuError";

  constructor(message: string) {
    super(message);
  }
}

export class InvalidIdError extends Error {
  override readonly name = "InvalidIdError";

  constructor(message: string) {
    super(message);
  }
}
