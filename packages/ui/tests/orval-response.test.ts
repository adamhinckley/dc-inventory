import { describe, expect, it } from "vitest";
import {
  assertSuccessfulOrvalResponse,
  isSuccessfulOrvalResponse,
  readOrvalHttpStatus,
} from "../src/shared/http/orval-response";

describe("orval HTTP envelope helpers", () => {
  it("reads status from Orval responses", () => {
    expect(readOrvalHttpStatus({ status: 409, data: { error: "conflict" } })).toBe(409);
    expect(readOrvalHttpStatus({ ok: true })).toBeUndefined();
  });

  it("treats non-2xx envelopes as failures", () => {
    expect(isSuccessfulOrvalResponse({ status: 200, data: {} })).toBe(true);
    expect(isSuccessfulOrvalResponse({ status: 409, data: { error: "insufficient_atp" } })).toBe(
      false,
    );
    expect(() =>
      assertSuccessfulOrvalResponse({ status: 401, data: { error: "unauthorized" } }),
    ).toThrow("HTTP 401");
  });
});
