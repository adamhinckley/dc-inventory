import type { IProductRepository } from "@dc-inventory/catalog";
import type {
  ICustomerRepository,
  IExemptionCertificateRepository,
  IShipToRepository,
} from "@dc-inventory/customers";
import type {
  IPasswordHasher,
  IStaffUserRepository,
  IWholesaleUserRepository,
} from "@dc-inventory/identity";
import type { Phase2BootstrapPorts } from "@dc-inventory/inventory";
import type { ISupplierRepository } from "@dc-inventory/purchasing";

export type ProductImageSeedRow = {
  productId: string;
  objectKey: string;
  contentType: string;
};

export interface IProductImageSeedRepository {
  save(row: ProductImageSeedRow): Promise<void>;
  listAll(): Promise<readonly ProductImageSeedRow[]>;
}

export type SupplierProductSeedRow = {
  supplierId: string;
  sku: string;
  minOrderQty: number | null;
};

export interface ISupplierProductSeedRepository {
  save(row: SupplierProductSeedRow): Promise<void>;
  listAll(): Promise<readonly SupplierProductSeedRow[]>;
}

export type StaticDemoSeedPorts = {
  products: IProductRepository;
  productImages: IProductImageSeedRepository;
  customers: ICustomerRepository;
  shipTos: IShipToRepository;
  exemptionCertificates: IExemptionCertificateRepository;
  staffUsers: IStaffUserRepository;
  wholesaleUsers: IWholesaleUserRepository;
  passwords: IPasswordHasher;
  /** Must be the same persistence as `phase2Bootstrap.upsertPrerequisiteSupplier`. */
  suppliers: ISupplierRepository;
  supplierProducts: ISupplierProductSeedRepository;
  phase2Bootstrap: Phase2BootstrapPorts;
};
