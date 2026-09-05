import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DashboardTableUrlCleanup source", () => {
  it("skips stripping on popstate so back restores table query keys", () => {
    const source = readFileSync(
      new URL("../components/dashboard-table-url-cleanup.tsx", import.meta.url),
      "utf8",
    );
    expect(source).toContain("popstate");
    expect(source).toContain("skipNextStrip");
    expect(source).toContain("skipNextStrip.current");
    expect(source).toContain("shouldStripStaffTableUrlOnNavigate");
    expect(source).toMatch(/stripStaffTableUrlParams\(current\)/);
  });
});
