export const PHASE2_DEFAULT_LOCATION_CODE = "DEFAULT";

export const PHASE2_SUPPLIER_VENDOR_NUMBER = "VEND-001";
export const PHASE2_SUPPLIER_NAME = "Demo Supplier";

export type Phase2BootstrapPorts = {
  upsertDefaultLocation(): Promise<{ id: string; code: string }>;
  upsertPrerequisiteSupplier(): Promise<{ id: string; vendorNumber: string }>;
};

export type Phase2BootstrapResult = {
  location: { id: string; code: string };
  supplier: { id: string; vendorNumber: string };
};

/**
 * Upsert the DEFAULT warehouse location and one supplier prerequisite.
 * Writes no stock movements, snapshots, adjustments, or purchase orders.
 */
export async function runPhase2Bootstrap(
  ports: Phase2BootstrapPorts,
): Promise<Phase2BootstrapResult> {
  const location = await ports.upsertDefaultLocation();
  const supplier = await ports.upsertPrerequisiteSupplier();
  return { location, supplier };
}
