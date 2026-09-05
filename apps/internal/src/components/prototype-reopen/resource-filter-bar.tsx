"use client";

/**
 * PROTOTYPE port of Desktop design-system ResourceFilterBar
 * (Search + chips + Add Filter). Static options only — no cube.
 */
import { Menu, Popover, Select, TextInput } from "@dc-inventory/ui";
import { Plus, Search, X } from "lucide-react";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ActiveFilter, FilterState, FilterValue } from "./use-local-filters";

const SEARCH_DEBOUNCE_MS = 300;

const FilterBarContext = createContext<FilterState | null>(null);

function useBar() {
  const ctx = use(FilterBarContext);
  if (!ctx) {
    throw new Error("ResourceFilterBar children need <ResourceFilterBar>");
  }
  return ctx;
}

export type FilterOption = { value: string; label: string };

export type FilterField = {
  label: string;
  filter:
    | { kind: "select"; options: FilterOption[] }
    | { kind: "boolean" }
    | { kind: "text" };
};

function ResourceFilterBarRoot({
  filters,
  children,
  className,
}: {
  filters: FilterState;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <FilterBarContext value={filters}>
      <div className={`flex min-w-0 flex-1 flex-wrap items-center gap-2 ${className ?? ""}`}>
        {children}
      </div>
    </FilterBarContext>
  );
}

function ResourceFilterBarSearch({
  placeholder,
  debounceMs = SEARCH_DEBOUNCE_MS,
}: {
  placeholder?: string;
  debounceMs?: number;
}) {
  const { search, setSearch } = useBar();
  const [local, setLocal] = useState(search);
  const lastCommitted = useRef(search);

  useEffect(() => {
    if (search === lastCommitted.current) {
      return;
    }
    lastCommitted.current = search;
    setLocal(search);
  }, [search]);

  useEffect(() => {
    if (local === search) {
      return;
    }
    const timer = setTimeout(() => {
      lastCommitted.current = local;
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
      data-testid="prototype-reopen-filter-search"
    />
  );
}

function isEmptyValue(value: FilterValue): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  if (typeof value === "string") {
    return value === "";
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
}

function formatValue(field: FilterField, value: FilterValue): string {
  if (isEmptyValue(value)) {
    return "...";
  }
  if (field.filter.kind === "boolean") {
    return value === true ? field.label : `Not ${field.label}`;
  }
  if (field.filter.kind === "select" && typeof value === "string") {
    return field.filter.options.find((row) => row.value === value)?.label ?? value;
  }
  return String(value);
}

function FilterChip({
  fieldKey,
  field,
  value,
  removable,
  autoOpen,
  onAutoOpened,
  onRemove,
  onUpdate,
}: {
  fieldKey: string;
  field: FilterField;
  value: FilterValue;
  removable: boolean;
  autoOpen?: boolean;
  onAutoOpened?: () => void;
  onRemove?: () => void;
  onUpdate: (value: FilterValue) => void;
}) {
  const [open, setOpen] = useState(Boolean(autoOpen));
  const empty = isEmptyValue(value);

  useEffect(() => {
    if (autoOpen) {
      onAutoOpened?.();
    }
  }, [autoOpen, onAutoOpened]);

  const label = (
    <>
      <span className="font-medium text-fg-secondary">
        {field.label}
        {empty ? "" : ":"}
      </span>
      {empty ? null : <span className="text-fg">{formatValue(field, value)}</span>}
    </>
  );

  const triggerClass = `inline-flex items-center gap-1.5 px-2 py-1 text-xs hover:bg-interactive-hover ${
    removable ? "rounded-l-interactable" : "rounded-interactable"
  }`;
  const wrapClass =
    "inline-flex items-center gap-0 rounded-interactable border border-border bg-surface-card text-xs";

  const remove = removable ? (
    <button
      type="button"
      tabIndex={0}
      className="inline-flex items-center rounded-r-interactable px-1 py-1 text-fg-tertiary hover:bg-interactive-hover hover:text-fg"
      aria-label={`Remove ${field.label} filter`}
      onClick={onRemove}
    >
      <X className="size-icon-sm" />
    </button>
  ) : null;

  if (field.filter.kind === "boolean") {
    return (
      <Menu open={open} onOpenChange={setOpen}>
        <div className={wrapClass}>
          <Menu.Trigger className={triggerClass} data-testid={`filter-bar-${fieldKey}-trigger`}>
            {label}
          </Menu.Trigger>
          {remove}
        </div>
        <Menu.Content
          side="bottom"
          align="start"
          className="min-w-48"
          data-testid={`filter-bar-${fieldKey}-popup`}
        >
          <Menu.Group>
            <Menu.GroupLabel>{field.label}</Menu.GroupLabel>
            <Menu.Item onClick={() => { onUpdate(true); setOpen(false); }}>
              {field.label}
            </Menu.Item>
            <Menu.Item onClick={() => { onUpdate(false); setOpen(false); }}>
              {`Not ${field.label}`}
            </Menu.Item>
          </Menu.Group>
        </Menu.Content>
      </Menu>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={wrapClass}>
        <Popover.Trigger className={triggerClass} data-testid={`filter-bar-${fieldKey}-trigger`}>
          {label}
        </Popover.Trigger>
        {remove}
      </div>
      <Popover.Content
        side="bottom"
        align="start"
        className="min-w-48 max-w-72"
        data-testid={`filter-bar-${fieldKey}-popup`}
      >
        <p className="mb-2 text-label text-fg-tertiary">{field.label}</p>
        {field.filter.kind === "select" ? (
          <Select
            density="compact"
            options={field.filter.options}
            value={typeof value === "string" ? value : null}
            onChange={(next) => onUpdate(next)}
            placeholder="Choose…"
            data-testid={`filter-bar-${fieldKey}-editor`}
          />
        ) : (
          <TextInput
            density="compact"
            value={typeof value === "string" ? value : ""}
            onChange={(next) => onUpdate(next || null)}
            data-testid={`filter-bar-${fieldKey}-editor`}
          />
        )}
      </Popover.Content>
    </Popover>
  );
}

function ResourceFilterBarChips({
  fields,
  pinned,
  resource,
}: {
  fields: Record<string, FilterField>;
  pinned?: readonly string[];
  resource?: string;
}) {
  const filters = useBar();
  const [pendingOpen, setPendingOpen] = useState<string | null>(null);
  const handleAdd = useCallback(
    (key: string) => {
      filters.onAdd(key);
      setPendingOpen(key);
    },
    [filters],
  );
  const clearPending = useCallback(() => setPendingOpen(null), []);

  const pinnedSet = new Set(pinned ?? []);
  const activeMap = new Map(filters.active.map((row) => [row.field, row.value]));
  const keys = Object.keys(fields);
  const pinnedKeys = keys.filter((key) => pinnedSet.has(key));
  const otherActive = filters.active
    .map((row) => row.field)
    .filter((key) => fields[key] && !pinnedSet.has(key));
  const available = keys.filter((key) => !pinnedSet.has(key) && !activeMap.has(key));

  const pinnedWithValue = pinnedKeys.filter((key) => !isEmptyValue(activeMap.get(key) ?? null))
    .length;
  const showClear = pinnedWithValue + otherActive.length > 1;

  return (
    <>
      {pinnedKeys.map((key) => (
        <FilterChip
          key={key}
          fieldKey={key}
          field={fields[key]!}
          value={activeMap.get(key) ?? null}
          removable={false}
          autoOpen={pendingOpen === key}
          onAutoOpened={clearPending}
          onUpdate={(value) => filters.onUpdate(key, value)}
        />
      ))}
      {otherActive.map((key) => (
        <FilterChip
          key={key}
          fieldKey={key}
          field={fields[key]!}
          value={activeMap.get(key) ?? null}
          removable
          autoOpen={pendingOpen === key}
          onAutoOpened={clearPending}
          onRemove={() => filters.onRemove(key)}
          onUpdate={(value) => filters.onUpdate(key, value)}
        />
      ))}
      {available.length > 0 ? (
        <Menu>
          <Menu.Trigger
            className="inline-flex items-center gap-1 rounded-interactable border border-dashed border-border px-2 py-1 text-xs text-fg-secondary hover:bg-interactive-hover"
            data-testid="filter-bar-add-trigger"
          >
            <Plus className="size-icon-sm" />
            Add Filter
            {resource ? ` — ${resource}` : ""}
          </Menu.Trigger>
          <Menu.Content
            side="bottom"
            align="start"
            className="min-w-48"
            data-testid="filter-bar-add-popup"
          >
            {available.map((key) => (
              <Menu.Item key={key} onClick={() => handleAdd(key)}>
                {fields[key]!.label}
              </Menu.Item>
            ))}
          </Menu.Content>
        </Menu>
      ) : null}
      {showClear ? (
        <button
          type="button"
          className="text-xs text-fg-tertiary transition-colors hover:text-fg"
          onClick={filters.onClear}
        >
          Clear all
        </button>
      ) : null}
    </>
  );
}

export const ResourceFilterBar = Object.assign(ResourceFilterBarRoot, {
  Search: ResourceFilterBarSearch,
  Chips: ResourceFilterBarChips,
});

export function defaultReopenFilters(): ActiveFilter[] {
  return [
    { field: "sellState", value: "locked" },
    { field: "excludeNeverOpen", value: true },
    { field: "active", value: true },
  ];
}
