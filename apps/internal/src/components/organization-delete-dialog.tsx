"use client";

import {
  getListInternalOrganizationsQueryKey,
  useDeleteInternalOrganization,
} from "@dc-inventory/api-client-internal";
import { Button, Dialog, useToast } from "@dc-inventory/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";

export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
};

export function OrganizationDeleteDialog({
  organization,
  open,
  onOpenChange,
}: {
  organization: OrganizationRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mutateAsync, isPending } = useDeleteInternalOrganization();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDelete() {
    setErrorMessage(null);
    try {
      const result = await mutateAsync({ id: organization.id });
      if (result.status === 204) {
        toast({
          intent: "success",
          title: "Company deleted",
          testid: "organization-delete-success-toast",
        });
        await queryClient.invalidateQueries({
          queryKey: getListInternalOrganizationsQueryKey(),
        });
        onOpenChange(false);
        return;
      }
      if (result.status === 409 && result.data.error === "org_not_empty") {
        setErrorMessage(
          "This company still has catalog, customer, sales, purchasing, or inventory data and cannot be deleted.",
        );
        return;
      }
      if (result.status === 409 && result.data.error === "default_organization") {
        setErrorMessage("The default company cannot be deleted.");
        return;
      }
      setErrorMessage("Could not delete this company.");
    } catch {
      setErrorMessage("Could not delete this company.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!isPending) {
          if (!nextOpen) {
            setErrorMessage(null);
          }
          onOpenChange(nextOpen);
        }
      }}
    >
      <Dialog.Content size="md" data-testid="organization-delete-dialog">
        <Dialog.Header>
          <Dialog.Title>Are you sure you want to delete this org?</Dialog.Title>
          <Dialog.Close />
        </Dialog.Header>
        <Dialog.Body className="flex flex-col gap-field-group">
          <Dialog.Description>
            This will permanently delete {organization.name} ({organization.slug}) and revoke its
            staff sessions. Catalog, customer, sales, purchasing, and inventory data must be gone
            first.
          </Dialog.Description>
          {errorMessage !== null ? (
            <p className="text-body-sm text-danger" role="alert">{errorMessage}</p>
          ) : null}
        </Dialog.Body>
        <Dialog.Footer>
          <Button type="button" variant="secondary" disabled={isPending} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={isPending}
            onClick={() => {
              void handleDelete();
            }}
          >
            <Trash2 className="size-icon" aria-hidden />
            Delete Company
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
