"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  applyColorScheme,
  COLOR_SCHEME_PREF_KEY,
  isColorScheme,
  type ColorScheme,
} from "../lib/color-scheme";

type ColorSchemeContextValue = {
  scheme: ColorScheme;
  setScheme: (scheme: ColorScheme) => void;
};

const ColorSchemeContext = createContext<ColorSchemeContextValue | null>(null);

function readStoredScheme(): ColorScheme {
  try {
    const raw = globalThis.localStorage?.getItem(COLOR_SCHEME_PREF_KEY);
    if (raw == null) {
      return "light";
    }
    const parsed: unknown = JSON.parse(raw);
    return isColorScheme(parsed) ? parsed : "light";
  } catch {
    return "light";
  }
}

function writeStoredScheme(scheme: ColorScheme): void {
  try {
    globalThis.localStorage?.setItem(COLOR_SCHEME_PREF_KEY, JSON.stringify(scheme));
  } catch {
    return;
  }
}

export function ColorSchemeProvider({ children }: { children: ReactNode }) {
  const [scheme, setSchemeState] = useState<ColorScheme>("light");

  useEffect(() => {
    setSchemeState(readStoredScheme());
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      applyColorScheme(scheme, media.matches, document.documentElement);
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [scheme]);

  function setScheme(next: ColorScheme) {
    writeStoredScheme(next);
    setSchemeState(next);
  }

  return (
    <ColorSchemeContext value={{ scheme, setScheme }}>{children}</ColorSchemeContext>
  );
}

export function useColorScheme(): ColorSchemeContextValue {
  const value = useContext(ColorSchemeContext);
  if (value === null) {
    throw new Error("useColorScheme must be used inside ColorSchemeProvider");
  }
  return value;
}
