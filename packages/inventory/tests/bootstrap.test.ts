import { describe, expect, it } from "vitest";
import {
  PHASE2_DEFAULT_LOCATION_CODE,
  PHASE2_SUPPLIER_VENDOR_NUMBER,
  runPhase2Bootstrap,
  type Phase2BootstrapPorts,
} from "../src/bootstrap/run-phase2-bootstrap.js";

function memoryPorts(): Phase2BootstrapPorts & {
  locations: Map<string, { id: string; code: string }>;
  suppliers: Map<string, { id: string; vendorNumber: string }>;
} {
  const locations = new Map<string, { id: string; code: string }>();
  const suppliers = new Map<string, { id: string; vendorNumber: string }>();
  let locationSeq = 0;
  let supplierSeq = 0;

  return {
    locations,
    suppliers,
    async upsertDefaultLocation() {
      const existing = locations.get(PHASE2_DEFAULT_LOCATION_CODE);
      if (existing) {
        return existing;
      }
      const row = {
        id: `loc-${String(++locationSeq)}`,
        code: PHASE2_DEFAULT_LOCATION_CODE,
      };
      locations.set(PHASE2_DEFAULT_LOCATION_CODE, row);
      return row;
    },
    async upsertPrerequisiteSupplier() {
      const existing = suppliers.get(PHASE2_SUPPLIER_VENDOR_NUMBER);
      if (existing) {
        return existing;
      }
      const row = {
        id: `sup-${String(++supplierSeq)}`,
        vendorNumber: PHASE2_SUPPLIER_VENDOR_NUMBER,
      };
      suppliers.set(PHASE2_SUPPLIER_VENDOR_NUMBER, row);
      return row;
    },
  };
}

describe("Phase 2 bootstrap (in-memory)", () => {
  it("upserts DEFAULT location and one supplier without stock rows", async () => {
    const ports = memoryPorts();
    const first = await runPhase2Bootstrap(ports);
    const second = await runPhase2Bootstrap(ports);

    expect(first.location.code).toBe(PHASE2_DEFAULT_LOCATION_CODE);
    expect(first.supplier.vendorNumber).toBe(PHASE2_SUPPLIER_VENDOR_NUMBER);
    expect(second.location.id).toBe(first.location.id);
    expect(second.supplier.id).toBe(first.supplier.id);
    expect(ports.locations.size).toBe(1);
    expect(ports.suppliers.size).toBe(1);
  });
});
