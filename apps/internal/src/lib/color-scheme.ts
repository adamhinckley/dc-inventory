export const COLOR_SCHEME_PREF_KEY = "dc-inventory.pref.colorScheme";

export const COLOR_SCHEMES = ["light", "dark", "system"] as const;

export type ColorScheme = (typeof COLOR_SCHEMES)[number];

export function isColorScheme(value: unknown): value is ColorScheme {
  return COLOR_SCHEMES.includes(value as ColorScheme);
}

export function isDarkScheme(
  scheme: ColorScheme,
  prefersDark: boolean,
): boolean {
  if (scheme === "dark") {
    return true;
  }
  if (scheme === "light") {
    return false;
  }
  return prefersDark;
}

export function applyColorScheme(
  scheme: ColorScheme,
  prefersDark: boolean,
  root: { classList: { toggle: (name: string, force?: boolean) => void }; setAttribute: (name: string, value: string) => void },
): void {
  const dark = isDarkScheme(scheme, prefersDark);
  root.classList.toggle("dark", dark);
  root.setAttribute("data-theme", dark ? "dark" : "light");
}
