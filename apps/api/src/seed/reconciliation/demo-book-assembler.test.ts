import { describe, expect, it } from "vitest";
import { assertDemoBook } from "./assert-demo-book.js";
import {
  assembleDemoBook,
  demoBookToRowBundle,
} from "./demo-book-assembler.js";
import { InMemoryDemoBookReader } from "./in-memory-demo-book-reader.js";
import {
  buildValidReducedDemoBook,
  REDUCED_DEMO_RECONCILIATION_EXPECTATIONS,
  reducedDemoSeedToday,
} from "./valid-reduced-demo-book.js";

describe("demo book assembler", () => {
  it("round-trips a valid reduced book through the Postgres row bundle", async () => {
    const source = buildValidReducedDemoBook();
    const assembled = assembleDemoBook(demoBookToRowBundle(source));

    const memoryResult = await assertDemoBook(new InMemoryDemoBookReader(source), {
      seedToday: reducedDemoSeedToday(),
      expectations: REDUCED_DEMO_RECONCILIATION_EXPECTATIONS,
    });
    const assembledResult = await assertDemoBook(new InMemoryDemoBookReader(assembled), {
      seedToday: reducedDemoSeedToday(),
      expectations: REDUCED_DEMO_RECONCILIATION_EXPECTATIONS,
    });

    expect(memoryResult).toEqual({ ok: true });
    expect(assembledResult).toEqual({ ok: true });
    expect(assembled).toEqual(source);
  });
});
