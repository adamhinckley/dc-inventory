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
});
