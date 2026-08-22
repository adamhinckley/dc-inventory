import { InvalidSkuError } from "./errors.js";

const MAX_SKU_LENGTH = 64;
const SKU_PATTERN = new RegExp(
  `^[A-Za-z0-9][A-Za-z0-9._:-]{0,${String(MAX_SKU_LENGTH - 1)}}$`,
);

/**
 * Stock-keeping identity. Not a product variant model — SKU is the v1 grain.
 */
export class Sku {
  readonly value: string;

  private constructor(value: string) {
    this.value = value;
    Object.freeze(this);
  }

  static parse(value: string): Sku {
    if (value !== value.trim()) {
      throw new InvalidSkuError("Sku must not have leading or trailing whitespace");
    }
    if (value.length === 0 || value.length > MAX_SKU_LENGTH) {
      throw new InvalidSkuError(
        `Sku must be 1–${String(MAX_SKU_LENGTH)} characters, got length ${String(value.length)}`,
      );
    }
    if (!SKU_PATTERN.test(value)) {
      throw new InvalidSkuError(
        "Sku must start with alphanumeric and contain only letters, digits, . _ : -",
      );
    }
    return new Sku(value);
  }

  equals(other: Sku): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
