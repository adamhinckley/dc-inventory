import { createContext, type ReactNode } from "react";
import type { FieldConfig } from "../resource/types";

export type FormFieldContextValue = {
  field: FieldConfig;
  fieldState: {
    error?: { message?: string };
    invalid?: boolean;
  };
  error?: { message?: string };
};

export const FormFieldContext = createContext<FormFieldContextValue | null>(
  null,
);

export function FormFieldProvider({
  value,
  children,
}: {
  value: FormFieldContextValue;
  children: ReactNode;
}) {
  return <FormFieldContext value={value}>{children}</FormFieldContext>;
}
