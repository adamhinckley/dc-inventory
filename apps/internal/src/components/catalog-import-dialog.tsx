"use client";

import {
  getListInternalProductsQueryKey,
  getListInternalSuppliersQueryKey,
  useImportInternalProducts,
} from "@dc-inventory/api-client-internal";
import {
  Button,
  Dialog,
  FieldRow,
  Input,
  Label,
  LabeledField,
} from "@dc-inventory/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";

type ImportSummary = {
  dryRun: boolean;
  rowsOk: number;
  created: number;
  updated: number;
  linked: number;
  errors: Array<{ row: number; field: string; message: string }>;
};

const ERROR_PREVIEW = 40;

export function CatalogImportDialog() {
  const fileInputId = useId();
  const queryClient = useQueryClient();
  const { mutateAsync, isPending } = useImportInternalProducts();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(dryRun: boolean) {
    if (file === null) {
      setError("Choose a Product Browser CSV first.");
      return;
    }
    setError(null);
    try {
      const response = await mutateAsync({
        data: { file },
        params: { dryRun },
      });
      if (response.status !== 200) {
        setError("Import failed. Check the file and try again.");
        return;
      }
      setResult(response.data);
      if (!dryRun) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getListInternalProductsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getListInternalSuppliersQueryKey() }),
        ]);
      }
    } catch {
      setError("Import failed. Check the file and try again.");
    }
  }

  const previewErrors = result?.errors.slice(0, ERROR_PREVIEW) ?? [];
  const hiddenErrorCount = (result?.errors.length ?? 0) - previewErrors.length;

  return (
    <Dialog>
      <Dialog.Trigger
        render={
          <Button type="button" variant="primary">
            Import Product Browser
          </Button>
        }
        data-testid="catalog-import-dialog-trigger"
      />
      <Dialog.Content size="lg" data-testid="catalog-import-dialog">
        <Dialog.Header>
          <Dialog.Title>Import Product Browser</Dialog.Title>
          <Dialog.Close />
        </Dialog.Header>
        <Dialog.Body className="flex flex-col gap-form-section">
          <Dialog.Description>
            Upload the Product Browser CSV. Check the file first, then import.
            Quantity columns are ignored.
          </Dialog.Description>
          <FieldRow>
            <LabeledField className="min-w-56 flex-1">
              <Label htmlFor={fileInputId}>CSV file</Label>
              <Input
                id={fileInputId}
                type="file"
                accept=".csv,text/csv"
                data-testid="catalog-import-file"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setResult(null);
                  setError(null);
                }}
              />
            </LabeledField>
            <Button
              type="button"
              disabled={isPending}
              onClick={() => void run(true)}
              data-testid="catalog-import-dry-run"
            >
              Check file
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={isPending}
              onClick={() => void run(false)}
              data-testid="catalog-import-commit"
            >
              Import
            </Button>
          </FieldRow>
          {error !== null ? <p className="text-body text-error">{error}</p> : null}
          {result !== null ? (
            <div className="flex flex-col gap-field">
              <p className="text-body">
                {result.dryRun
                  ? `${String(result.rowsOk)} rows ready to import.`
                  : `Imported ${String(result.created)} new, ${String(result.updated)} updated, ${String(result.linked)} vendor links.`}
                {result.errors.length > 0
                  ? ` ${String(result.errors.length)} row errors.`
                  : ""}
              </p>
              {previewErrors.length > 0 ? (
                <ul className="text-body-sm text-fg-secondary">
                  {previewErrors.map((row) => (
                    <li key={`${String(row.row)}-${row.field}-${row.message}`}>
                      Row {row.row}, {row.field}: {row.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              {hiddenErrorCount > 0 ? (
                <p className="text-body-sm text-fg-secondary">
                  And {String(hiddenErrorCount)} more.
                </p>
              ) : null}
            </div>
          ) : null}
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close render={<Button type="button">Close</Button>} />
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
