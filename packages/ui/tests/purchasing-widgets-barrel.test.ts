import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  Combobox,
  DetailView,
  ExplorerView,
  Form,
  FormDialog,
  RepeatableFields,
  scrollToFirstError,
  useDetailView,
  useExplorerView,
  useFormSubmit,
} from "../src/index";

const uiSrc = join(dirname(fileURLToPath(import.meta.url)), "../src");

describe("@dc-inventory/ui purchasing widget barrel", () => {
  it("re-exports purchasing layout and form widgets", () => {
    expect(Combobox).toBeTypeOf("function");
    expect(Form).toBeTypeOf("function");
    expect(FormDialog).toBeTypeOf("function");
    expect(ExplorerView).toBeTypeOf("function");
    expect(DetailView).toBeTypeOf("function");
    expect(RepeatableFields).toBeTypeOf("function");
    expect(scrollToFirstError).toBeTypeOf("function");
    expect(useFormSubmit).toBeTypeOf("function");
    expect(useExplorerView).toBeTypeOf("function");
    expect(useDetailView).toBeTypeOf("function");
  });

  it("marks Form and FormDialog as client modules so the App Router barrel is safe from RSC", () => {
    const files = [
      "ui/Form/Form.tsx",
      "ui/Form/Form.hook.ts",
      "ui/Form/index.ts",
      "ui/FormDialog/FormDialog.tsx",
      "ui/FormDialog/index.ts",
    ];
    for (const file of files) {
      const source = readFileSync(join(uiSrc, file), "utf8");
      expect(source, file).toMatch(/^(?:\/\/[^\n]*\n)*'use client'\n/);
    }
  });
});
