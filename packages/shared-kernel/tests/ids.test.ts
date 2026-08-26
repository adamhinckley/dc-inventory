import { describe, expect, it } from "vitest";
import {
  AddOnId,
  CustomerId,
  InstallationId,
  InvalidIdError,
  InvoiceId,
  LocationId,
  OrganizationId,
  OrderId,
  ProductId,
  PurchaseOrderId,
  SessionId,
  StaffUserId,
  SupplierId,
  TenantId,
  WholesaleUserId,
} from "../src/index.js";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("branded IDs", () => {
  it("parses a UUID into each architecture ID", () => {
    expect(ProductId.parse(UUID)).toBe(UUID);
    expect(CustomerId.parse(UUID)).toBe(UUID);
    expect(OrderId.parse(UUID)).toBe(UUID);
    expect(PurchaseOrderId.parse(UUID)).toBe(UUID);
    expect(TenantId.parse(UUID)).toBe(UUID);
    expect(AddOnId.parse(UUID)).toBe(UUID);
    expect(InstallationId.parse(UUID)).toBe(UUID);
    expect(InvoiceId.parse(UUID)).toBe(UUID);
    expect(SupplierId.parse(UUID)).toBe(UUID);
    expect(StaffUserId.parse(UUID)).toBe(UUID);
    expect(WholesaleUserId.parse(UUID)).toBe(UUID);
    expect(SessionId.parse(UUID)).toBe(UUID);
  });

  it("rejects a non-UUID", () => {
    expect(() => ProductId.parse("not-a-uuid")).toThrow(InvalidIdError);
    expect(() => ProductId.parse("")).toThrow(InvalidIdError);
    expect(() => LocationId.parse("warehouse-1")).toThrow(InvalidIdError);
  });

  it("exposes LocationId.DEFAULT for the v1 single warehouse", () => {
    expect(LocationId.DEFAULT).toBe("DEFAULT");
    expect(LocationId.parse("DEFAULT")).toBe(LocationId.DEFAULT);
    expect(LocationId.parse(UUID)).toBe(UUID);
  });

  it("exposes OrganizationId.DEFAULT for the v1 single organization", () => {
    expect(OrganizationId.DEFAULT).toBe("DEFAULT");
    expect(OrganizationId.parse("DEFAULT")).toBe(OrganizationId.DEFAULT);
    expect(OrganizationId.parse(UUID)).toBe(UUID);
    expect(() => OrganizationId.parse("acme")).toThrow(InvalidIdError);
  });
});
