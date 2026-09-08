"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import {
  Button,
  FieldRow,
  LabeledField,
  Label,
  TextInput,
  buttonVariants,
  cn,
} from "@dc-inventory/ui";
import { Lock, Save } from "lucide-react";
import { sellWindowsPrototypeHref } from "../prototype-href";
import { useSellWindowsPrototype } from "../sell-windows-prototype-context";
import { FilterControls } from "../shared/filter-controls";
import { PrototypeBanner } from "../shared/prototype-banner";
import { PrototypeDevTools } from "../shared/prototype-dev-tools";
import { SkuReviewTable } from "../shared/sku-review-table";
import { WindowDateFields } from "../shared/window-date-fields";
import { WindowStatusChip } from "../shared/window-status-chip";

export function SellWindowEditorPage({ windowId }: { windowId: string | null }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const store = useSellWindowsPrototype();
  const cloneFrom = searchParams.get("clone");
  const isNew = windowId === null;
  const isExisting = !isNew;

  useEffect(() => {
    if (isNew) {
      if (cloneFrom) {
        store.prepareClone(cloneFrom);
        return;
      }
      store.prepareNewWindow();
      return;
    }
    if (windowId !== null && !store.loadWindow(windowId)) {
      router.replace(sellWindowsPrototypeHref("/inventory/reopen"));
    }
  }, [cloneFrom, isNew, router, store.loadWindow, store.prepareClone, store.prepareNewWindow, windowId]);

  const title = isNew
    ? "New sell window"
    : (store.editingWindow?.name ?? "Sell window");

  function applyOpenInfinity() {
    const createdId = store.openInfinity();
    if (createdId !== null) {
      router.push(sellWindowsPrototypeHref("/inventory/reopen"));
    }
  }

  function applyCloseInfinity() {
    if (windowId === null || store.editingWindow === null) {
      return;
    }
    if (store.closeWindow(windowId)) {
      router.push(sellWindowsPrototypeHref("/inventory/reopen"));
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-form-section pb-8">
      <PrototypeBanner />
      <nav className="text-body-sm text-fg-secondary">
        <Link href={sellWindowsPrototypeHref("/inventory/reopen")} className="hover:underline">
          Sell Windows
        </Link>
        <span aria-hidden> / </span>
        <span className="text-fg">{title}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-field-group">
        <div>
          <h2 className="text-heading-sm">{title}</h2>
          {!isNew && store.editingWindow ? (
            <div className="mt-tight flex items-center gap-tight">
              <WindowStatusChip status={store.editingWindow.status} />
              <span className="text-body-sm text-fg-secondary">
                Applied {new Date(store.editingWindow.appliedAt).toLocaleDateString()} by{" "}
                {store.editingWindow.appliedBy}
              </span>
            </div>
          ) : (
            <p className="text-body-sm text-fg-secondary">
              Choose categories and factories, set open/close dates, then review SKUs before
              opening infinity.
            </p>
          )}
        </div>
      </div>

      {isNew ? (
        <LabeledField className="max-w-md">
          <Label htmlFor="window-name">Window name</Label>
          <TextInput
            id="window-name"
            density="compact"
            value={store.windowName}
            onChange={store.setWindowName}
          />
        </LabeledField>
      ) : null}

      <WindowDateFields
        opensAt={store.opensAt}
        closesAt={store.closesAt}
        onOpensAt={store.setOpensAt}
        onClosesAt={store.setClosesAt}
        readOnly={isExisting}
      />

      {isNew ? (
        <>
          <section className="flex flex-col gap-field-group">
            <h3 className="text-label text-fg-secondary">Match SKUs</h3>
            <FilterControls filters={store.filters} onChange={store.setFilters} />
          </section>

          <div className="flex flex-wrap items-center gap-tight">
            <Button type="button" variant="secondary" size="sm" onClick={store.selectAllMatching}>
              Select All Eligible
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => store.uncheckSupplier("sup-xd")}
            >
              Uncheck XD Factory
            </Button>
            <span className="text-body-sm text-fg-secondary">
              {store.selectedSkus.length} of {store.applyEligibleSkus.length} eligible checked
              (inactive and discontinued are skipped on apply)
            </span>
          </div>

          <SkuReviewTable
            skus={store.matchingSkus}
            windows={store.windows}
            now={store.now}
            checkedSkus={store.checkedSkus}
            onToggle={store.toggleSku}
          />
        </>
      ) : (
        <>
          <section className="flex flex-col gap-field-group">
            <h3 className="text-label text-fg-secondary">Saved filters</h3>
            <FilterControls filters={store.filters} onChange={() => {}} readOnly />
          </section>
          <SkuReviewTable
            skus={store.state.skus.filter((sku) =>
              store.editingWindow?.skuIds.includes(sku.sku),
            )}
            windows={store.windows}
            now={store.now}
            checkedSkus={Object.fromEntries(
              (store.editingWindow?.skuIds ?? []).map((sku) => [sku, true]),
            )}
            onToggle={() => {}}
            readOnly
          />
        </>
      )}

      <FieldRow>
        {isNew ? (
          <Button type="button" variant="primary" onClick={applyOpenInfinity}>
            <Save className="size-icon" aria-hidden />
            Save
          </Button>
        ) : null}
        {!isNew &&
        store.editingWindow &&
        store.editingWindow.status !== "closed" &&
        store.editingWindow.manuallyClosedAt === null ? (
          <Button type="button" variant="primary" onClick={applyCloseInfinity}>
            <Lock className="size-icon" aria-hidden />
            Close Infinity
          </Button>
        ) : null}
        {isExisting &&
        store.editingWindow &&
        store.editingWindow.status === "closed" ? (
          <Link
            href={sellWindowsPrototypeHref(
              `/inventory/reopen/new?clone=${store.editingWindow?.id ?? ""}`,
            )}
            className={cn(buttonVariants({ variant: "secondary" }))}
          >
            Clone As New
          </Link>
        ) : null}
        <Link
          href={sellWindowsPrototypeHref("/inventory/reopen")}
          className={cn(buttonVariants({ variant: "secondary" }))}
        >
          Back To List
        </Link>
      </FieldRow>

      <PrototypeDevTools />
    </div>
  );
}
