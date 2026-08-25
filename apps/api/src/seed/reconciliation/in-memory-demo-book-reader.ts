import type { DemoBook, IDemoBookReader } from "./demo-book.js";

export class InMemoryDemoBookReader implements IDemoBookReader {
  constructor(private readonly book: DemoBook) {}

  async load(): Promise<DemoBook> {
    return structuredClone(this.book);
  }
}
