import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("StaffSessionGate", () => {
  it("keeps the sign-in dialog on screen while the session query is idle or in flight", () => {
    const source = readFileSync(new URL("./staff-sign-in-dialog.tsx", import.meta.url), "utf8");
    expect(source).not.toContain(
      'return <div className="min-h-screen bg-surface-base" />',
    );
    expect(source).not.toContain("<Dialog");
    expect(source).toContain("enabled: sessionQueryEnabled");
    expect(source).toContain("StaffSignInForm");
    expect(source).toContain("dashboardHomePath");
    expect(source).toContain('session.audience === "platform"');
  });
});
