import { createContext, type ReactNode } from "react";

export type Option<T extends string | number | boolean = string> = {
  value: T;
  label: string;
  disabled?: boolean;
};

export type RenderCtx<T = unknown> = {
  value: unknown;
  record: T;
};

export type FieldInput<T = unknown> = T;

export type FormFieldSlot = {
  kind?: string;
  options?: Option[] | (() => Promise<Option[]>);
  optionsSource?: unknown;
  [key: string]: unknown;
};

export type LiveTableState = {
  arrivingIds?: readonly string[];
  departedIds?: readonly string[];
  flashedIds?: readonly string[];
  hasPendingChanges?: boolean;
  mode?: string;
  pendingCount?: number;
  onCommit?: () => void;
  [key: string]: unknown;
};

export type FormFieldMeta = FormFieldSlot;

export type FormRenderFn = (...args: never[]) => unknown;

export type FieldConfig<T = unknown> = {
  label?: ReactNode;
  form?: FormFieldSlot;
  name?: string;
  [key: string]: unknown;
} & { __record?: T };

export type Action = unknown;
export type BulkAction = unknown;
export type RecordAction = unknown;
export type FilterValue = unknown;
export type ActiveFilter = unknown;
export type FilterFieldSlot = unknown;
export type FilterChipLabel = unknown;
export type FilterRenderFn = unknown;
export type ConfirmConfig = unknown;
export type ActionCtx = unknown;
