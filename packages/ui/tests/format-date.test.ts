import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "../src/lib/format-date";

describe("formatDate", () => {
  it("formats an ISO instant in UTC", () => {
    expect(formatDate("2026-08-22T15:04:00.000Z", "UTC")).toBe("Aug 22, 2026");
  });
});

describe("formatDateTime", () => {
  it("formats date and time in UTC", () => {
    expect(formatDateTime("2026-08-22T15:04:00.000Z", "UTC")).toBe(
      "Aug 22, 2026, 3:04 PM",
    );
  });
});
