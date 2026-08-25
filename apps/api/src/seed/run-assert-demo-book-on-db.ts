import type { AppDrizzle } from "../infrastructure/db.js";
import { assertDemoBook, type AssertDemoBookOptions } from "./reconciliation/assert-demo-book.js";
import { PostgresDemoBookReader } from "./reconciliation/postgres-demo-book-reader.js";

/**
 * Run shared Demo reconciliation against Postgres after seed playback.
 */
export async function runAssertDemoBookOnDb(
  db: AppDrizzle,
  options: AssertDemoBookOptions,
): Promise<Awaited<ReturnType<typeof assertDemoBook>>> {
  return assertDemoBook(new PostgresDemoBookReader(db), options);
}
