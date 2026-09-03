"use client";

import { Menu } from "@dc-inventory/ui";
import { EllipsisVertical } from "lucide-react";

export function CatalogProductRowMenu({
  sku,
  onEdit,
}: {
  sku: string;
  onEdit: () => void;
}) {
  return (
    <Menu>
      <Menu.Trigger
        aria-label={`Actions for ${sku}`}
        data-testid={`catalog-row-menu-${sku}`}
        className="interactable subtle flex size-icon-lg items-center justify-center"
      >
        <EllipsisVertical className="size-icon-lg" aria-hidden />
      </Menu.Trigger>
      <Menu.Content
        align="end"
        data-testid={`catalog-row-menu-${sku}-popup`}
      >
        <Menu.Item onClick={onEdit}>Edit Product</Menu.Item>
      </Menu.Content>
    </Menu>
  );
}
