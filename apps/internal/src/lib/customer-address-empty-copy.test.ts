import { describe, expect, it } from "vitest";
import {
  BILL_TO_EMPTY_SHIP_REFUSES_COPY,
  SHIP_TOS_EMPTY_MESSAGE,
  billToEmptyMessage,
} from "./customer-address-empty-copy";

describe("customer address empty copy", () => {
  it("uses locked ship-tos empty copy without requiring a default to ship", () => {
    expect(SHIP_TOS_EMPTY_MESSAGE).toBe("No ship-to addresses yet.");
    expect(SHIP_TOS_EMPTY_MESSAGE.toLowerCase()).not.toContain("default");
    expect(SHIP_TOS_EMPTY_MESSAGE.toLowerCase()).not.toContain("required");
  });

  it("explains bill-to empty blocks shipping until a bill-to exists", () => {
    const message = billToEmptyMessage(false);
    expect(message).toContain("bill-to");
    expect(message).toContain(BILL_TO_EMPTY_SHIP_REFUSES_COPY.trim());
    expect(message.toLowerCase()).not.toContain("default ship-to");
  });

  it("offers copy-from-default when a default ship-to exists", () => {
    const message = billToEmptyMessage(true);
    expect(message).toContain("copy from the default ship-to");
    expect(message).not.toContain(BILL_TO_EMPTY_SHIP_REFUSES_COPY.trim());
  });
});
