"use client";

import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentPropsWithRef,
  type ReactNode,
} from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { cn } from "#cn";
import { Button } from "#ds/ui/Button";
import { Popover } from "#ds/ui/Popover";
import { Menu } from "#ds/ui/Menu";
import { TextInput } from "#ds/ui/TextInput";
import { useFilterOptions } from "#shared/resource/use-filter-options";
import type { FilterState } from "#shared/resource/filter-state";
import type { FieldConfig, FilterFieldSlot, FilterValue } from "#shared/resource/types";

const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_THRESHOLD = 8;

const ResourceFilterBarContext = createContext<FilterState | null>(null);

function useResourceFilterBarContext() {
  const ctx = use(ResourceFilterBarContext);
  if (!ctx) {
    throw new Error("ResourceFilterBar sub-components must be used inside <ResourceFilterBar>");
  }
  return ctx;
}

export interface ResourceFilterBarRootProps extends Omit<ComponentPropsWithRef<"div">, "children"> {
  filters: FilterState;
  children?: ReactNode;
}

export function ResourceFilterBarRoot({
  filters,
  className,
  children,
  ref,
  ...rest
}: ResourceFilterBarRootProps) {
  return (
    <ResourceFilterBarContext value={filters}>
      <div
        ref={ref}
        className={cn("flex flex-wrap items-center gap-2", className)}
        {...rest}
      >
        {children}
      </div>
    </ResourceFilterBarContext>
  );
}

export interface ResourceFilterBarSearchProps {
  placeholder?: string;
  debounceMs?: number;
}

export function ResourceFilterBarSearch({
  placeholder,
  debounceMs = SEARCH_DEBOUNCE_MS,
}: ResourceFilterBarSearchProps) {
  const { search, setSearch } = useResourceFilterBarContext();
  const [local, setLocal] = useState(search);
  const lastCommittedRef = useRef(search);

  useEffect(() => {
    if (search === lastCommittedRef.current) return;
    lastCommittedRef.current = search;
    setLocal(search);
  }, [search]);

  useEffect(() => {
    if (local === search) return;
    const timer = setTimeout(() => {
      lastCommittedRef.current = local;
      setSearch(local);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [local, search, setSearch, debounceMs]);

  return (
    <TextInput
      density="compact"
      className="w-52 shrink-0"
      icon={<Search className="size-icon" />}
      value={local}
      onChange={setLocal}
      placeholder={placeholder}
      data-testid="resource-filter-bar-search"
    />
  );
}

type FilterableField = {
  label?: ReactNode;
  filter?: FieldConfig["filter"];
};

export interface ResourceFilterBarChipsProps {
  fields: Record<string, FilterableField>;
  pinned?: readonly string[];
  resource?: string;
}

interface FilterEntry {
  key: string;
  label: string;
  filter: FilterFieldSlot;
}

function toEntries(fields: Record<string, FilterableField>): FilterEntry[] {
  const out: FilterEntry[] = [];
  for (const [key, field] of Object.entries(fields)) {
    if (!field.filter) continue;
    const label = typeof field.label === "string" && field.label !== "" ? field.label : key;
    out.push({ key, label, filter: field.filter });
  }
  return out;
}

function isEmptyValue(value: FilterValue | null): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value === "";
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

export function ResourceFilterBarChips({ fields, pinned, resource }: ResourceFilterBarChipsProps) {
  const filters = useResourceFilterBarContext();
  const [pendingOpen, setPendingOpen] = useState<string | null>(null);

  const handleAdd = useCallback(
    (key: string) => {
      filters.onAdd(key);
      setPendingOpen(key);
    },
    [filters],
  );
  const clearPendingOpen = useCallback(() => setPendingOpen(null), []);

  const entries = toEntries(fields);
  const pinnedSet = new Set(pinned ?? []);
  const activeMap = new Map(filters.active.map((filter) => [filter.field, filter.value]));
  const pinnedEntries = entries.filter((entry) => pinnedSet.has(entry.key));
  const otherActiveEntries = filters.active
    .map((filter) => entries.find((entry) => entry.key === filter.field))
    .filter((entry): entry is FilterEntry => !!entry && !pinnedSet.has(entry.key));
  const available = entries.filter(
    (entry) => !pinnedSet.has(entry.key) && !activeMap.has(entry.key),
  );
  const pinnedWithValue = pinnedEntries.filter(
    (entry) => !isEmptyValue(activeMap.get(entry.key) ?? null),
  ).length;
  const showClearAll = pinnedWithValue + otherActiveEntries.length > 1;

  if (pinnedEntries.length === 0 && otherActiveEntries.length === 0 && available.length === 0) {
    return null;
  }

  return (
    <>
      {pinnedEntries.map((entry) => (
        <FilterChip
          key={entry.key}
          entry={entry}
          resource={resource}
          value={activeMap.get(entry.key) ?? null}
          removable={false}
          onUpdate={(value) => filters.onUpdate(entry.key, value)}
          autoOpen={pendingOpen === entry.key}
          onAutoOpened={clearPendingOpen}
        />
      ))}
      {otherActiveEntries.map((entry) => (
        <FilterChip
          key={entry.key}
          entry={entry}
          resource={resource}
          value={activeMap.get(entry.key) ?? null}
          removable
          onRemove={() => filters.onRemove(entry.key)}
          onUpdate={(value) => filters.onUpdate(entry.key, value)}
          autoOpen={pendingOpen === entry.key}
          onAutoOpened={clearPendingOpen}
        />
      ))}
      <AddFilterButton available={available} onAdd={handleAdd} />
      {showClearAll ? (
        <button
          type="button"
          onClick={filters.onClear}
          className="text-xs text-fg-tertiary transition-colors hover:text-fg"
        >
          Clear all
        </button>
      ) : null}
    </>
  );
}

function formatFilterValue(value: FilterValue, entry: FilterEntry): string {
  if (value === null || value === undefined) return "...";
  if (typeof value === "boolean") {
    return value ? entry.label : `Not ${entry.label}`;
  }
  if (typeof value === "string") {
    if (entry.filter.kind === "select" && Array.isArray(entry.filter.options)) {
      return entry.filter.options.find((option) => option.value === value)?.label ?? value;
    }
    return value || "...";
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "...";
    if (entry.filter.kind === "multiselect") {
      return `${value.length} selected`;
    }
    return value.join(", ");
  }
  return String(value);
}

function pluralize(word: string, count: number): string {
  if (count === 1) return word;
  if (word.endsWith("y") && !/[aeiou]y$/i.test(word)) {
    return `${word.slice(0, -1)}ies`;
  }
  return `${word}s`;
}

function FilterChip({
  entry,
  resource,
  value,
  removable,
  onRemove,
  onUpdate,
  autoOpen,
  onAutoOpened,
}: {
  entry: FilterEntry;
  resource?: string;
  value: FilterValue | null;
  removable: boolean;
  onRemove?: () => void;
  onUpdate: (value: FilterValue) => void;
  autoOpen?: boolean;
  onAutoOpened?: () => void;
}) {
  const [open, setOpen] = useState(Boolean(autoOpen));
  const isEmpty = isEmptyValue(value);

  useEffect(() => {
    if (autoOpen) onAutoOpened?.();
  }, [autoOpen, onAutoOpened]);

  const commitAndClose = (next: FilterValue) => {
    onUpdate(next);
    setOpen(false);
  };

  const dropdownTitle =
    resource && entry.label !== resource && !entry.label.startsWith(`${resource} `)
      ? `${resource} ${entry.label}`
      : entry.label;

  const labelContent = (
    <>
      <span className="font-medium text-fg-secondary">
        {entry.label}
        {!isEmpty ? ":" : ""}
      </span>
      {!isEmpty ? (
        <span className="text-fg">{formatFilterValue(value as FilterValue, entry)}</span>
      ) : null}
    </>
  );

  const triggerClass = cn(
    "inline-flex items-center gap-1.5 px-2 py-1 text-xs hover:bg-interactive-hover",
    removable ? "rounded-l-interactable" : "rounded-interactable",
  );
  const removeButton = removable ? (
    <button
      type="button"
      onClick={onRemove}
      tabIndex={0}
      className="inline-flex items-center rounded-r-interactable px-1 py-1 text-fg-tertiary hover:bg-interactive-hover hover:text-fg focus-visible:outline-1 focus-visible:outline-primary"
      aria-label={`Remove ${entry.label} filter`}
    >
      <X className="size-icon-sm" />
    </button>
  ) : null;
  const chipWrapClass =
    "inline-flex items-center gap-0 rounded-interactable border border-border bg-surface-card text-xs";

  if (entry.filter.kind === "boolean") {
    return (
      <Menu open={open} onOpenChange={setOpen}>
        <div className={chipWrapClass}>
          <Menu.Trigger className={triggerClass} data-testid={`filter-bar-${entry.key}-trigger`}>
            {labelContent}
          </Menu.Trigger>
          {removeButton}
        </div>
        <Menu.Content
          side="bottom"
          align="start"
          className="min-w-48"
          data-testid={`filter-bar-${entry.key}-popup`}
        >
          <div className="item-padding text-label text-fg-tertiary">{dropdownTitle}</div>
          <Menu.Item onClick={() => commitAndClose(true)}>{entry.label}</Menu.Item>
          <Menu.Item onClick={() => commitAndClose(false)}>{`Not ${entry.label}`}</Menu.Item>
        </Menu.Content>
      </Menu>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={chipWrapClass}>
        <Popover.Trigger className={triggerClass} data-testid={`filter-bar-${entry.key}-trigger`}>
          {labelContent}
        </Popover.Trigger>
        {removeButton}
      </div>
      <Popover.Content
        side="bottom"
        align="start"
        className="min-w-48 max-w-72"
        data-testid={`filter-bar-${entry.key}-popup`}
      >
        <div className="mb-2 text-label text-fg-tertiary">{dropdownTitle}</div>
        {entry.filter.kind === "select" || entry.filter.kind === "multiselect" ? (
          <FilterOptionsEditor
            entryKey={entry.key}
            label={entry.label}
            filter={entry.filter}
            value={value}
            onApply={commitAndClose}
            onCancel={() => setOpen(false)}
          />
        ) : (
          <TextEditor value={value} onUpdate={onUpdate} data-testid={`filter-bar-${entry.key}-editor`} />
        )}
      </Popover.Content>
    </Popover>
  );
}

function FilterOptionsEditor({
  entryKey,
  label,
  filter,
  value,
  onApply,
  onCancel,
}: {
  entryKey: string;
  label: string;
  filter: Extract<FilterFieldSlot, { kind: "select" | "multiselect" }>;
  value: FilterValue | null;
  onApply: (next: FilterValue) => void;
  onCancel: () => void;
}) {
  const { options, loading } = useFilterOptions(filter.options);
  const multiple = filter.kind === "multiselect";
  const currentSingle = !multiple && typeof value === "string" ? value : null;
  const [pendingMulti, setPendingMulti] = useState<string[]>(
    multiple && Array.isArray(value) ? [...value] : [],
  );
  const [search, setSearch] = useState("");
  const showSearch = options.length > SEARCH_THRESHOLD;
  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const needle = search.toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(needle));
  }, [options, search]);

  const isSelected = (optionValue: string) =>
    multiple ? pendingMulti.includes(optionValue) : currentSingle === optionValue;

  const handleRowClick = (optionValue: string) => {
    if (multiple) {
      setPendingMulti((current) =>
        current.includes(optionValue)
          ? current.filter((item) => item !== optionValue)
          : [...current, optionValue],
      );
      return;
    }
    onApply(currentSingle === optionValue ? null : optionValue);
  };

  return (
    <div className="flex w-56 flex-col gap-2">
      {showSearch ? (
        <TextInput
          density="compact"
          value={search}
          onChange={setSearch}
          placeholder="Search..."
          autoFocus
          data-testid={`filter-bar-${entryKey}-search`}
        />
      ) : null}
      <div className="flex max-h-64 flex-col overflow-y-auto">
        {loading ? (
          <div className="py-2 text-center text-xs text-fg-tertiary">Loading…</div>
        ) : filteredOptions.length === 0 ? (
          <div className="py-2 text-center text-xs text-fg-tertiary">No options</div>
        ) : (
          filteredOptions.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => handleRowClick(String(option.value))}
              className="interactable ghost item-padding flex items-center justify-between gap-icon text-xs focus-visible:-outline-offset-2"
              data-testid={`filter-bar-${entryKey}-option-${String(option.value)}`}
            >
              <span className="text-left">{option.label}</span>
              {isSelected(String(option.value)) ? (
                <Check className="size-icon shrink-0 text-primary" aria-hidden />
              ) : null}
            </button>
          ))
        )}
      </div>
      {multiple ? (
        <div className="flex items-center justify-end gap-2 border-t border-border pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            data-testid={`filter-bar-${entryKey}-cancel`}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onApply(pendingMulti.length === 0 ? null : pendingMulti)}
            data-testid={`filter-bar-${entryKey}-apply`}
          >
            {`Apply (${pendingMulti.length} ${pluralize(label.toLowerCase(), pendingMulti.length)})`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function TextEditor({
  value,
  onUpdate,
  "data-testid": testid,
}: {
  value: FilterValue | null;
  onUpdate: (next: FilterValue) => void;
  "data-testid": string;
}) {
  const [local, setLocal] = useState(typeof value === "string" ? value : "");

  useEffect(() => {
    const upstream = typeof value === "string" ? value : "";
    if (local === upstream) return;
    const timer = setTimeout(() => onUpdate(local || null), 300);
    return () => clearTimeout(timer);
  }, [local, value, onUpdate]);

  return (
    <TextInput
      density="compact"
      value={local}
      onChange={setLocal}
      placeholder="Type to filter..."
      autoFocus
      data-testid={testid}
    />
  );
}

function AddFilterButton({
  available,
  onAdd,
}: {
  available: FilterEntry[];
  onAdd: (key: string) => void;
}) {
  if (available.length === 0) return null;

  return (
    <Menu>
      <Menu.Trigger data-testid="filter-bar-add-trigger">
        <span className="inline-flex items-center gap-1 rounded-interactable border border-dashed border-border px-2 py-1 text-xs text-fg-secondary transition-colors hover:border-fg-muted hover:text-fg">
          <Plus className="size-icon-sm" />
          Add Filter
        </span>
      </Menu.Trigger>
      <Menu.Content align="start" data-testid="filter-bar-add-popup">
        {available.map((entry) => (
          <Menu.Item key={entry.key} onClick={() => onAdd(entry.key)}>
            {entry.label}
          </Menu.Item>
        ))}
      </Menu.Content>
    </Menu>
  );
}
