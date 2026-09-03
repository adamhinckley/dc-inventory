import { describe, expect, it } from "vitest";

import { cn } from "../src/lib/cn";
import { buttonVariants } from "../src/ui/Button/Button";

describe("cn / tailwind-merge", () => {
  it("keeps type-scale text-* next to ink-color text-*", () => {
    const merged = cn("text-button", "text-primary-content");
    expect(merged).toContain("text-button");
    expect(merged).toContain("text-primary-content");
  });

  it("still lets a later font-size replace text-button", () => {
    const merged = cn("text-button", "text-sm");
    expect(merged.split(/\s+/)).toContain("text-sm");
    expect(merged.split(/\s+/)).not.toContain("text-button");
  });

  it("keeps 12px button type on a primary md Button", () => {
    const merged = cn(buttonVariants({ variant: "primary", size: "md" }));
    expect(merged).toContain("text-button");
    expect(merged).toContain("font-bold");
    expect(merged).toContain("text-primary-content");
  });
});
