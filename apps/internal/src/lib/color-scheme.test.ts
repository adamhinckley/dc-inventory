import { describe, expect, it } from "vitest";
import {
  applyColorScheme,
  isColorScheme,
  isDarkScheme,
} from "./color-scheme";

describe("color scheme", () => {
  it("accepts light, dark, and system only", () => {
    expect(isColorScheme("light")).toBe(true);
    expect(isColorScheme("dark")).toBe(true);
    expect(isColorScheme("system")).toBe(true);
    expect(isColorScheme("g100")).toBe(false);
  });

  it("keeps light and dark explicit; system follows the OS", () => {
    expect(isDarkScheme("light", true)).toBe(false);
    expect(isDarkScheme("dark", false)).toBe(true);
    expect(isDarkScheme("system", true)).toBe(true);
    expect(isDarkScheme("system", false)).toBe(false);
  });

  it("toggles the document dark class and data-theme", () => {
    const classes = new Set<string>();
    const attrs: Record<string, string> = {};
    const root = {
      classList: {
        toggle: (name: string, force?: boolean) => {
          if (force) {
            classes.add(name);
          } else {
            classes.delete(name);
          }
        },
      },
      setAttribute: (name: string, value: string) => {
        attrs[name] = value;
      },
    };

    applyColorScheme("dark", false, root);
    expect(classes.has("dark")).toBe(true);
    expect(attrs["data-theme"]).toBe("dark");

    applyColorScheme("light", true, root);
    expect(classes.has("dark")).toBe(false);
    expect(attrs["data-theme"]).toBe("light");
  });
});
