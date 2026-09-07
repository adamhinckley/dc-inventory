import type { OrganizationId } from "@dc-inventory/shared-kernel";
import type { ISupplierLinkPort, SupplierLinkRequest, SupplierLinkResult } from "../domain/ports/supplier-link.js";

type StoredLink = {
  vendorNumber: string;
  vendorName: string;
  sku: string;
};

export class InMemorySupplierLinkPort implements ISupplierLinkPort {
  readonly suppliers = new Map<string, { vendorNumber: string; name: string }>();
  readonly links: StoredLink[] = [];
  failWith: string | null = null;

  async linkSku(input: SupplierLinkRequest): Promise<SupplierLinkResult> {
    if (this.failWith !== null) {
      return { ok: false, message: this.failWith };
    }
    const key = `${input.organizationId}:${input.vendorNumber}`;
    this.suppliers.set(key, { vendorNumber: input.vendorNumber, name: input.vendorName });
    const existing = this.links.findIndex(
      (row) => row.sku === input.sku && row.vendorNumber === input.vendorNumber,
    );
    const next = {
      vendorNumber: input.vendorNumber,
      vendorName: input.vendorName,
      sku: input.sku,
    };
    if (existing >= 0) {
      this.links[existing] = next;
    } else {
      this.links.push(next);
    }
    return { ok: true };
  }

  async linkSkus(inputs: readonly SupplierLinkRequest[]): Promise<readonly SupplierLinkResult[]> {
    const results: SupplierLinkResult[] = [];
    for (const input of inputs) {
      results.push(await this.linkSku(input));
    }
    return results;
  }

  suppliersFor(organizationId: OrganizationId): { vendorNumber: string; name: string }[] {
    const prefix = `${organizationId}:`;
    return [...this.suppliers.entries()]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, value]) => value);
  }
}
