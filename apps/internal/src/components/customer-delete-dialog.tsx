"use client";

import {
  getListInternalCustomersQueryKey,
  useDeleteInternalCustomer,
} from "@dc-inventory/api-client-internal";
import { Button, Dialog, useToast } from "@dc-inventory/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";

export type CustomerDeleteRow = {
  id: string;
  name: string;
};

export function CustomerDeleteDialog({
  customer,
  open,
  onOpenChange,
  onDeleted,
}: {
  customer: CustomerDeleteRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mutateAsync, isPending } = useDeleteInternalCustomer();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleDelete() {
    setErrorMessage(null);
    try {
      const result = await mutateAsync({ id: customer.id });
      if (result.status === 204) {
        toast({
          intent: "success",
          title: "Customer deleted",
          testid: "customer-delete-success-toast",
        });
        await queryClient.invalidateQueries({
          queryKey: getListInternalCustomersQueryKey(),
        });
        onOpenChange(false);
        onDeleted?.();
        return;
      }
      if (result.status === 409 && result.data.error === "customer_not_empty") {
        setErrorMessage(
          "This customer still has orders, invoices, payments, or a payment plan and cannot be deleted.",
        );
        return;
      }
      setErrorMessage("Could not delete this customer.");
    } catch {
      setErrorMessage("Could not delete this customer.");
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
      <Dialog.Content size="md" data-testid="customer-delete-dialog">
        <Dialog.Header>
          <Dialog.Title>Delete this customer?</Dialog.Title>
          <Dialog.Close />
        </Dialog.Header>
        <Dialog.Body className="flex flex-col gap-field-group">
          <Dialog.Description>
            This will permanently delete {customer.name} and its wholesale logins, contacts,
            addresses, and certificates. Orders and accounts receivable must be gone first.
          </Dialog.Description>
          {errorMessage !== null ? (
            <p className="text-body-sm text-danger" role="alert">
              {errorMessage}
            </p>
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
            Delete Customer
          </Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
