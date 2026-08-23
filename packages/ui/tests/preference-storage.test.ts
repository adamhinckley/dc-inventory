import { afterEach, describe, expect, it } from "vitest";
import {
  PREFERENCE_KEY_PREFIX,
  readPreference,
  writePreference,
} from "../src/shared/hooks/preference-storage";

const store = new Map<string, string>();

const memoryStorage: Storage = {
  get length() {
    return store.size;
  },
  clear() {
    store.clear();
  },
  getItem(key: string) {
    return store.get(key) ?? null;
  },
  key() {
    return null;
  },
  removeItem(key: string) {
    store.delete(key);
  },
  setItem(key: string, value: string) {
    store.set(key, value);
  },
};

afterEach(() => {
  store.clear();
  Reflect.deleteProperty(globalThis, "localStorage");
});

describe("preference storage", () => {
  it("returns the fallback when Storage is missing", () => {
    expect(readPreference("sideNav.expanded", true)).toBe(true);
  });

  it("round-trips JSON under the dc-inventory prefix", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: memoryStorage,
    });

    writePreference("sideNav.expanded", false);
    expect(store.get(`${PREFERENCE_KEY_PREFIX}sideNav.expanded`)).toBe("false");
    expect(readPreference("sideNav.expanded", true)).toBe(false);

    writePreference("sideNav.openGroups", ["workspace"]);
    expect(readPreference("sideNav.openGroups", [] as string[])).toEqual([
      "workspace",
    ]);
  });

  it("returns the fallback when stored JSON is invalid", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: memoryStorage,
    });
    store.set(`${PREFERENCE_KEY_PREFIX}sideNav.expanded`, "{");
    expect(readPreference("sideNav.expanded", true)).toBe(true);
  });
});
