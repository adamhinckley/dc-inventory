import {
  CreateProductUseCase,
  DrizzleProductCategoryRepository,
  DrizzleProductPackagingRepository,
  DrizzleProductRepository,
  GetProductUseCase,
  GetWholesaleProductUseCase,
  ExportStaffProductsCsvUseCase,
  ImportProductBrowserUseCase,
  InMemoryCatalogCsvWriter,
  InMemoryCatalogListQuery,
  InMemoryProductCategoryRepository,
  InMemoryProductPackagingRepository,
  InMemoryProductRepository,
  InMemoryQtyReadPort,
  ListStaffCategoriesUseCase,
  ListStaffProductsUseCase,
  ListWholesaleCatalogUseCase,
  UpdateProductUseCase,
  type CatalogDrizzle,
  type ICatalogListQuery,
  DrizzleProductIdentifierRepository,
  InMemoryImportLocationPort,
  InMemoryProductIdentifierRepository,
  InMemoryProductPrimarySupplierReadPort,
  InMemoryProductReorderReadPort,
  type IImportLocationPort,
  type IImportReorderPolicyPort,
  type IProductCategoryRepository,
  type IProductIdentifierRepository,
  type IProductPackagingRepository,
  type IProductPrimarySupplierReadPort,
  type IProductReorderReadPort,
  type IProductRepository,
  type IQtyReadPort,
  type ISupplierLinkPort,
} from "@dc-inventory/catalog";
import {
  CopyBillToFromDefaultShipToUseCase,
  CreateBillToUseCase,
  CreateContactUseCase,
  CreateCustomerUseCase,
  CreateExemptionCertificateUseCase,
  CreateShipToUseCase,
  CustomerAccountStatusReadAdapter,
  CustomerBillToSnapshotReadAdapter,
  CustomerShipToSnapshotReadAdapter,
  DrizzleBillToRepository,
  DrizzleContactRepository,
  DrizzleCustomerRepository,
  DrizzleExemptionCertificateRepository,
  DrizzleShipToRepository,
  GetBillToUseCase,
  GetCustomerUseCase,
  GetWholesaleCustomerUseCase,
  InMemoryBillToRepository,
  InMemoryContactRepository,
  InMemoryCustomerRepository,
  InMemoryExemptionCertificateRepository,
  InMemoryShipToRepository,
  ListContactsUseCase,
  ListCustomersUseCase,
  ListExemptionCertificatesUseCase,
  ListShipTosUseCase,
  UpdateBillToUseCase,
  UpdateContactUseCase,
  UpdateCustomerUseCase,
  UpdateExemptionCertificateUseCase,
  UpdateShipToUseCase,
  UpdateWholesaleCustomerNoteUseCase,
  type CustomersDrizzle,
  type IContactRepository,
  type ICustomerAccountStatusReadPort,
  type ICustomerRepository,
  type IBillToRepository,
  type IExemptionCertificateRepository,
  type IShipToRepository,
} from "@dc-inventory/customers";
import {
  ClearActingCustomerUseCase,
  DrizzleOpsUserRepository,
  DrizzleSessionStore,
  InMemoryOpsUserRepository,
  ListActingCustomersUseCase,
  LoginOpsUseCase,
  ResolveOpsSessionUseCase,
  type IOpsUserRepository,
  DrizzleStaffUserRepository,
  DrizzleWholesaleUserRepository,
  DrizzleLoginThrottle,
  InMemoryLoginThrottle,
  InMemoryOrganizationRepository,
  InMemoryPasswordHasher,
  InMemorySessionStore,
  InMemoryStaffUserRepository,
  InMemoryWholesaleUserRepository,
  LoginStaffUseCase,
  LoginWholesaleUseCase,
  LogoutUseCase,
  ResolveStaffSessionUseCase,
  ResolveWholesaleSessionUseCase,
  SelectActingCustomerUseCase,
  ScryptPasswordHasher,
  DrizzleOrganizationRepository,
  type IPasswordHasher,
  type ILoginThrottle,
  type IOrganizationRepository,
  type ISessionStore,
  type IStaffUserRepository,
  type IWholesaleLoginAccountStatusReadPort,
  type IWholesaleUserRepository,
  type IdentityDrizzle,
  type IActingCustomerHeaderReadPort,
} from "@dc-inventory/identity";
import {
  DrizzleLicensingReadRepository,
  featuresAllCoreOn,
  InMemoryLicensingStore,
  LicensingFeatures,
  ListLicensingPaymentsUseCase,
  ListLicensingSubscriptionsUseCase,
  type IFeatures,
  type ILicensingReadRepository,
  type LicensingDrizzle,
} from "@dc-inventory/licensing";
import {
  AssignSupplierProductUseCase,
  CancelPurchaseOrderUseCase,
  CancelRemainingPurchaseOrderUseCase,
  ConfirmPurchaseOrderUseCase,
  CreatePurchaseOrderUseCase,
  CreateSupplierUseCase,
  DraftPurchaseOrdersFromUncoveredSkusUseCase,
  DrizzlePurchaseOrderRepository,
  DrizzleSupplierProductRepository,
  DrizzleSupplierRepository,
  ExportPurchaseOrderUseCase,
  ExcelJsWorkbookWriter,
  GetPurchaseOrderFactorySendUseCase,
  GetPurchaseOrderShortReadoutUseCase,
  GetPurchaseOrderUseCase,
  GetPurchaseOrderByDocumentNumberUseCase,
  GetSupplierUseCase,
  InMemoryPurchaseOrderRepository,
  InMemorySupplierProductRepository,
  InMemorySupplierRepository,
  InMemorySupplierSkuMappingReadPort,
  ListPurchaseOrdersUseCase,
  ListSupplierProductsUseCase,
  ListSuppliersUseCase,
  ReceivePurchaseOrderUseCase,
  ReplacePurchaseOrderLinesUseCase,
  SyncDraftPurchaseOrdersFromUncoveredUseCase,
  UnlinkSupplierProductUseCase,
  UpdateSupplierProductUseCase,
  UpdateSupplierUseCase,
  type ICatalogSkuLookupPort,
  type IFactorySendCatalogPort,
  type IPurchaseOrderRepository,
  type ISupplierProductQtyReadPort,
  type ISupplierProductRepository,
  type ISupplierRepository,
  type ICommittedCustomerNamesPort,
  type IInventoryUncoveredReadPort,
  type ISupplierSkuMappingReadPort,
  InMemoryUncoveredOpenDraftPurchaseOrderReadPort,
  type IUncoveredOpenDraftPurchaseOrderReadPort,
  type PurchasingDrizzle,
} from "@dc-inventory/purchasing";
import {
  CustomerTermsReadAdapter,
  DrizzleInvoiceRepository,
  GetInvoiceUseCase,
  InMemoryAccountingUnitOfWork,
  RecordPaymentUseCase,
  type AccountingDrizzle,
  type IInvoiceRepository,
} from "@dc-inventory/accounting";
import {
  CancelSalesOrderUseCase,
  ConfirmSalesOrderUseCase,
  CreateSalesOrderUseCase,
  DrizzleCommittedCustomerNamesListQuery,
  DrizzleSalesOrderRepository,
  GetSalesOrderUseCase,
  InMemoryCommittedCustomerNamesListQuery,
  InMemorySalesOrderRepository,
  ListSalesOrdersUseCase,
  ReplaceSalesOrderLinesUseCase,
  ShipSalesOrderUseCase,
  type ICatalogProductPort,
  type ICustomerBillToSnapshotReadPort,
  type ICustomerShipToSnapshotReadPort,
  type ICustomerLookupPort,
  type ISalesOrderRepository,
  type SalesDrizzle,
} from "@dc-inventory/sales";
import {
  CloseSellWindowUseCase,
  CreateSellWindowUseCase,
  DrizzleSellWindowRepository,
  GetSellWindowUseCase,
  GetStockSnapshotUseCase,
  InMemorySellWindowRepository,
  InMemoryUncoveredCaseQtyReadPort,
  InMemoryUncoveredListQuery,
  InMemoryUncoveredReorderPolicyReadPort,
  ListPurchaseOrderGoodsReceivedUseCase,
  ListSellWindowsUseCase,
  ListUncoveredFactoriesUseCase,
  ListUncoveredSkusUseCase,
  RecordReopenSkusForPresellUseCase,
  type InMemoryInventoryReadModel,
  type ISellWindowRepository,
  type IUncoveredListQuery,
  type RecordReopenSkusForPresellRequest,
} from "@dc-inventory/inventory";
import { OrganizationId, Sku } from "@dc-inventory/shared-kernel";
import { PurchaseOrderLookupAdapter } from "../adapters/purchase-order-lookup.js";
import {
  committedCustomerNamesPort,
  inventoryUncoveredReadPort,
} from "../adapters/purchasing-short-readout-ports.js";
import { catalogProductPort } from "../adapters/catalog-product-port.js";
import { InMemoryUnitOfWork } from "../adapters/in-memory-unit-of-work.js";
import { readFeaturesAllCoreOn } from "./features-all-core-on.js";
import { PostgresAccountingUnitOfWork } from "../adapters/postgres-accounting-unit-of-work.js";
import { PostgresInventoryUnitOfWork } from "../adapters/postgres-inventory-unit-of-work.js";
import { CatalogInventoryListQuery } from "../adapters/catalog-inventory-list-query.js";
import { UncoveredInventoryListQuery } from "../adapters/uncovered-inventory-list-query.js";
import {
  uncoveredCaseQtyReadPort,
  uncoveredReorderPolicyReadPort,
} from "../adapters/uncovered-stock-context-ports.js";
import { InventoryReadModelQtyReadAdapter } from "../adapters/inventory-read-model-qty-read.js";
import { PurchasingSupplierLinkAdapter } from "../adapters/purchasing-supplier-link.js";
import { PurchasingProductPrimarySupplierReadAdapter } from "../adapters/purchasing-product-primary-supplier-read.js";
import { InMemoryPurchasingProductPrimarySupplierReadAdapter } from "../adapters/in-memory-product-primary-supplier-read.js";
import { DrizzleProductReorderReadAdapter } from "../adapters/drizzle-product-reorder-read.js";
import { DrizzleImportReorderPolicyAdapter } from "../adapters/drizzle-import-reorder-policies.js";
import {
  catalogSkuLookupPort,
  factorySendCatalogPort,
  supplierProductQtyReadPort,
} from "../adapters/purchasing-catalog-ports.js";
import { supplierSkuMappingReadPort } from "../adapters/supplier-sku-mapping-read-port.js";
import {
  inMemoryUncoveredOpenDraftPurchaseOrderReadPort,
  uncoveredOpenDraftPurchaseOrderReadPort,
} from "../adapters/uncovered-open-draft-purchase-order-read-port.js";
import {
  uncoveredSkuDraftPurchaseOrderReadPort,
  uncoveredSkuSupplierMappingReadPort,
  uncoveredSkuSupplierReadPort,
} from "../adapters/uncovered-sku-enrichment-read-ports.js";
import { StockSnapshotQtyReadAdapter } from "../adapters/stock-snapshot-qty-read.js";
import { SystemClock } from "../adapters/system-clock.js";
import type { IUnitOfWork } from "../domain/unit-of-work.js";
import { DrizzleImportLocationAdapter } from "../adapters/drizzle-import-locations.js";
import type { AppDrizzle } from "./db.js";
import { PingUseCase } from "../application/ping.js";
import { ReadyCheckUseCase } from "../application/ready.js";
import type { IClock } from "../domain/clock.js";
import type { IDatabase } from "../domain/database.js";
import { createDatabaseConnection, PostgresDatabase } from "./db.js";

export type IdentityHttpServices = {
  loginOps: LoginOpsUseCase;
  loginThrottle: ILoginThrottle;
  loginStaff: LoginStaffUseCase;
  logoutOps: LogoutUseCase;
  resolveOps: ResolveOpsSessionUseCase;
  loginWholesale: LoginWholesaleUseCase;
  logoutStaff: LogoutUseCase;
  logoutWholesale: LogoutUseCase;
  resolveStaff: ResolveStaffSessionUseCase;
  resolveWholesale: ResolveWholesaleSessionUseCase;
  listActingCustomers: ListActingCustomersUseCase;
  selectActingCustomer: SelectActingCustomerUseCase;
  clearActingCustomer: ClearActingCustomerUseCase;
};

export type CatalogHttpServices = {
  listStaffProducts: ListStaffProductsUseCase;
  listStaffCategories: ListStaffCategoriesUseCase;
  exportStaffProductsCsv: ExportStaffProductsCsvUseCase;
  createProduct: CreateProductUseCase;
  getProduct: GetProductUseCase;
  updateProduct: UpdateProductUseCase;
  importProductBrowser: ImportProductBrowserUseCase;
  listWholesaleCatalog: ListWholesaleCatalogUseCase;
  getWholesaleProduct: GetWholesaleProductUseCase;
  lookupProductIdBySku: (
    organizationId: OrganizationId,
    sku: string,
  ) => Promise<string | null>;
  lookupProductIdsBySkus: (
    organizationId: OrganizationId,
    skus: readonly string[],
  ) => Promise<ReadonlyMap<string, string | null>>;
};

export type CustomersHttpServices = {
  listCustomers: ListCustomersUseCase;
  createCustomer: CreateCustomerUseCase;
  getCustomer: GetCustomerUseCase;
  updateCustomer: UpdateCustomerUseCase;
  listContacts: ListContactsUseCase;
  createContact: CreateContactUseCase;
  updateContact: UpdateContactUseCase;
  listShipTos: ListShipTosUseCase;
  createShipTo: CreateShipToUseCase;
  updateShipTo: UpdateShipToUseCase;
  listExemptionCertificates: ListExemptionCertificatesUseCase;
  createExemptionCertificate: CreateExemptionCertificateUseCase;
  updateExemptionCertificate: UpdateExemptionCertificateUseCase;
  getBillTo: GetBillToUseCase;
  createBillTo: CreateBillToUseCase;
  updateBillTo: UpdateBillToUseCase;
  copyBillToFromDefaultShipTo: CopyBillToFromDefaultShipToUseCase;
  getWholesaleCustomer: GetWholesaleCustomerUseCase;
  updateWholesaleCustomerNote: UpdateWholesaleCustomerNoteUseCase;
};

export type CustomerReadPorts = {
  billToSnapshot: ICustomerBillToSnapshotReadPort;
  shipToSnapshot: ICustomerShipToSnapshotReadPort;
  accountStatus: ICustomerAccountStatusReadPort;
};

export type PurchasingHttpServices = {
  listPurchaseOrders: ListPurchaseOrdersUseCase;
  createPurchaseOrder: CreatePurchaseOrderUseCase;
  getPurchaseOrder: GetPurchaseOrderUseCase;
  getPurchaseOrderByDocumentNumber: GetPurchaseOrderByDocumentNumberUseCase;
  confirmPurchaseOrder: ConfirmPurchaseOrderUseCase;
  receivePurchaseOrder: ReceivePurchaseOrderUseCase;
  replacePurchaseOrderLines: ReplacePurchaseOrderLinesUseCase;
  exportPurchaseOrder: ExportPurchaseOrderUseCase;
  getPurchaseOrderFactorySend: GetPurchaseOrderFactorySendUseCase;
  getPurchaseOrderShortReadout: GetPurchaseOrderShortReadoutUseCase;
  cancelPurchaseOrder: CancelPurchaseOrderUseCase;
  cancelRemainingPurchaseOrder: CancelRemainingPurchaseOrderUseCase;
  listSuppliers: ListSuppliersUseCase;
  createSupplier: CreateSupplierUseCase;
  getSupplier: GetSupplierUseCase;
  updateSupplier: UpdateSupplierUseCase;
  listSupplierProducts: ListSupplierProductsUseCase;
  assignSupplierProduct: AssignSupplierProductUseCase;
  updateSupplierProduct: UpdateSupplierProductUseCase;
  unlinkSupplierProduct: UnlinkSupplierProductUseCase;
  draftPurchaseOrdersFromUncoveredSkus: DraftPurchaseOrdersFromUncoveredSkusUseCase;
  syncDraftPurchaseOrdersFromUncovered: SyncDraftPurchaseOrdersFromUncoveredUseCase;
};

export type SalesHttpServices = {
  listSalesOrders: ListSalesOrdersUseCase;
  createSalesOrder: CreateSalesOrderUseCase;
  replaceSalesOrderLines: ReplaceSalesOrderLinesUseCase;
  getSalesOrder: GetSalesOrderUseCase;
  confirmSalesOrder: ConfirmSalesOrderUseCase;
  cancelSalesOrder: CancelSalesOrderUseCase;
  shipSalesOrder: ShipSalesOrderUseCase;
};

export type AccountingHttpServices = {
  getInvoice: GetInvoiceUseCase;
  recordPayment: RecordPaymentUseCase;
};

export type LicensingHttpServices = {
  listSubscriptions: ListLicensingSubscriptionsUseCase;
  listPayments: ListLicensingPaymentsUseCase;
};

export type InventoryHttpServices = {
  getStockSnapshot: GetStockSnapshotUseCase;
  listPurchaseOrderGoodsReceived: ListPurchaseOrderGoodsReceivedUseCase;
  listUncoveredSkus: ListUncoveredSkusUseCase;
  listUncoveredFactories: ListUncoveredFactoriesUseCase;
  reopenSkusForPresell: Pick<RecordReopenSkusForPresellUseCase, "execute">;
  listSellWindows: ListSellWindowsUseCase;
  getSellWindow: GetSellWindowUseCase;
  createSellWindow: CreateSellWindowUseCase;
  closeSellWindow: CloseSellWindowUseCase;
};

/**
 * Composition root services. Domain/application never import this file —
 * only `app.ts` / `server.ts` wire ports to adapters here.
 */
export type AppServices = {
  features: IFeatures;
  clock: IClock;
  database: IDatabase;
  ping: PingUseCase;
  ready: ReadyCheckUseCase;
  identity: IdentityHttpServices;
  customers: CustomersHttpServices;
  customerReadPorts: CustomerReadPorts;
  catalog: CatalogHttpServices;
  purchasing: PurchasingHttpServices;
  sales: SalesHttpServices;
  accounting: AccountingHttpServices;
  licensing: LicensingHttpServices;
  inventory: InventoryHttpServices;
  unitOfWork: IUnitOfWork;
};

export type AppServiceOverrides = {
  opsUsers?: IOpsUserRepository;
  features?: IFeatures;
  clock?: IClock;
  database?: IDatabase;
  staffUsers?: IStaffUserRepository;
  wholesaleUsers?: IWholesaleUserRepository;
  sessions?: ISessionStore;
  passwords?: IPasswordHasher;
  loginThrottle?: ILoginThrottle;
  organizationRepo?: IOrganizationRepository;
  customerRepo?: ICustomerRepository;
  contactRepo?: IContactRepository;
  shipToRepo?: IShipToRepository;
  billToRepo?: IBillToRepository;
  exemptionRepo?: IExemptionCertificateRepository;
  productRepo?: IProductRepository;
  productPackagingRepo?: IProductPackagingRepository;
  productCategoryRepo?: IProductCategoryRepository;
  productIdentifierRepo?: IProductIdentifierRepository;
  productPrimarySupplierRead?: IProductPrimarySupplierReadPort;
  productReorderRead?: IProductReorderReadPort;
  importLocationPort?: IImportLocationPort;
  importReorderPolicyPort?: IImportReorderPolicyPort;
  qtyRead?: IQtyReadPort;
  catalogListQuery?: ICatalogListQuery;
  purchaseOrderRepo?: IPurchaseOrderRepository;
  supplierRepo?: ISupplierRepository;
  supplierProductRepo?: ISupplierProductRepository;
  supplierSkuMapping?: import("@dc-inventory/purchasing").ISupplierSkuMappingReadPort;
  openDraftPurchaseOrderRead?: IUncoveredOpenDraftPurchaseOrderReadPort;
  catalogSkuLookup?: ICatalogSkuLookupPort;
  factorySendCatalog?: IFactorySendCatalogPort;
  supplierProductQtyRead?: ISupplierProductQtyReadPort;
  catalogProduct?: ICatalogProductPort;
  salesOrderRepo?: ISalesOrderRepository;
  invoiceRepo?: IInvoiceRepository;
  accountingUnitOfWork?: import("@dc-inventory/accounting").IAccountingUnitOfWork;
  unitOfWork?: IUnitOfWork;
  uncoveredList?: IUncoveredListQuery;
  uncoveredCaseQtyRead?: import("@dc-inventory/inventory").IUncoveredCaseQtyReadPort;
  uncoveredReorderPolicyRead?: import("@dc-inventory/inventory").IUncoveredReorderPolicyReadPort;
  sellWindowRepo?: ISellWindowRepository;
  licensingStore?: InMemoryLicensingStore;
  licensingRepository?: ILicensingReadRepository;
};

function catalogServices(
  productRepo: IProductRepository,
  qtyRead: IQtyReadPort,
  catalogListQuery: ICatalogListQuery,
  supplierLink: ISupplierLinkPort,
  packaging: IProductPackagingRepository,
  productCategories: IProductCategoryRepository,
  productIdentifiers: IProductIdentifierRepository,
  productPrimarySupplier: IProductPrimarySupplierReadPort,
  productReorder: IProductReorderReadPort,
  importLocations: IImportLocationPort,
  importReorderPolicies: IImportReorderPolicyPort,
): CatalogHttpServices {
  const createProduct = new CreateProductUseCase(productRepo);
  const updateProduct = new UpdateProductUseCase(
    productRepo,
    qtyRead,
    packaging,
    productCategories,
    productIdentifiers,
    productPrimarySupplier,
    productReorder,
  );
  return {
    listStaffProducts: new ListStaffProductsUseCase(catalogListQuery),
    listStaffCategories: new ListStaffCategoriesUseCase(productRepo),
    exportStaffProductsCsv: new ExportStaffProductsCsvUseCase(
      catalogListQuery,
      new InMemoryCatalogCsvWriter(),
    ),
    createProduct,
    getProduct: new GetProductUseCase(
      productRepo,
      qtyRead,
      packaging,
      productCategories,
      productIdentifiers,
      productPrimarySupplier,
      productReorder,
    ),
    updateProduct,
    importProductBrowser: new ImportProductBrowserUseCase(
      productRepo,
      supplierLink,
      packaging,
      productCategories,
      productIdentifiers,
      importLocations,
      importReorderPolicies,
    ),
    listWholesaleCatalog: new ListWholesaleCatalogUseCase(catalogListQuery),
    getWholesaleProduct: new GetWholesaleProductUseCase(productRepo, qtyRead),
    lookupProductIdBySku: async (organizationId, sku) => {
      try {
        const product = await productRepo.findBySku(organizationId, Sku.parse(sku));
        return product?.id ?? null;
      } catch {
        return null;
      }
    },
    lookupProductIdsBySkus: async (organizationId, skus) => {
      const parsedSkus: Sku[] = [];
      for (const sku of skus) {
        try {
          parsedSkus.push(Sku.parse(sku));
        } catch {
          // skip invalid sku values
        }
      }
      const products = await productRepo.findBySkus(organizationId, parsedSkus);
      const result = new Map<string, string | null>();
      for (const sku of skus) {
        result.set(sku, products.get(sku)?.id ?? null);
      }
      return result;
    },
  };
}

function customersServices(
  customerRepo: ICustomerRepository,
  contactRepo: IContactRepository,
  shipToRepo: IShipToRepository,
  billToRepo: IBillToRepository,
  exemptionRepo: IExemptionCertificateRepository,
): CustomersHttpServices {
  return {
    listCustomers: new ListCustomersUseCase(customerRepo),
    createCustomer: new CreateCustomerUseCase(customerRepo),
    getCustomer: new GetCustomerUseCase(customerRepo),
    updateCustomer: new UpdateCustomerUseCase(customerRepo),
    listContacts: new ListContactsUseCase(customerRepo, contactRepo),
    createContact: new CreateContactUseCase(customerRepo, contactRepo),
    updateContact: new UpdateContactUseCase(customerRepo, contactRepo),
    listShipTos: new ListShipTosUseCase(customerRepo, shipToRepo),
    createShipTo: new CreateShipToUseCase(customerRepo, shipToRepo),
    updateShipTo: new UpdateShipToUseCase(customerRepo, shipToRepo),
    listExemptionCertificates: new ListExemptionCertificatesUseCase(
      customerRepo,
      exemptionRepo,
    ),
    createExemptionCertificate: new CreateExemptionCertificateUseCase(
      customerRepo,
      exemptionRepo,
    ),
    updateExemptionCertificate: new UpdateExemptionCertificateUseCase(
      customerRepo,
      exemptionRepo,
    ),
    getBillTo: new GetBillToUseCase(customerRepo, billToRepo),
    createBillTo: new CreateBillToUseCase(customerRepo, billToRepo),
    updateBillTo: new UpdateBillToUseCase(customerRepo, billToRepo),
    copyBillToFromDefaultShipTo: new CopyBillToFromDefaultShipToUseCase(
      customerRepo,
      shipToRepo,
      billToRepo,
    ),
    getWholesaleCustomer: new GetWholesaleCustomerUseCase(customerRepo),
    updateWholesaleCustomerNote: new UpdateWholesaleCustomerNoteUseCase(customerRepo),
  };
}

function customerReadPorts(
  customerRepo: ICustomerRepository,
  billToRepo: IBillToRepository,
  shipToRepo: IShipToRepository,
): CustomerReadPorts {
  return {
    billToSnapshot: new CustomerBillToSnapshotReadAdapter(customerRepo, billToRepo),
    shipToSnapshot: new CustomerShipToSnapshotReadAdapter(customerRepo, shipToRepo),
    accountStatus: new CustomerAccountStatusReadAdapter(customerRepo),
  };
}

function wholesaleLoginAccountStatusReadPort(
  accountStatus: ICustomerAccountStatusReadPort,
): IWholesaleLoginAccountStatusReadPort {
  return {
    getAccountStatus: (organizationId, linkedPartyId) =>
      accountStatus.getAccountStatus(organizationId, linkedPartyId),
  };
}

function actingCustomerHeaderReadPort(
  customerRepo: ICustomerRepository,
): IActingCustomerHeaderReadPort {
  return {
    async list(organizationId) {
      const pageSize = 100;
      let page = 1;
      const headers = [];
      while (true) {
        const result = await customerRepo.list({
          organizationId,
          page,
          pageSize,
          sortBy: "name",
          sortOrder: "asc",
        });
        headers.push(
          ...result.items.map((customer) => ({
            customerId: customer.id,
            businessName: customer.name,
            customerNumber: customer.customerNumber,
          })),
        );
        const offset = (page - 1) * pageSize + result.items.length;
        if (offset >= result.total || result.items.length < pageSize) {
          break;
        }
        page += 1;
      }
      return headers;
    },
    async findById(organizationId, customerId) {
      const customer = await customerRepo.findById(organizationId, customerId);
      if (customer === null) {
        return null;
      }
      return {
        customerId: customer.id,
        businessName: customer.name,
        customerNumber: customer.customerNumber,
      };
    },
  };
}

function purchasingServices(
  purchaseOrderRepo: IPurchaseOrderRepository,
  supplierRepo: ISupplierRepository,
  supplierProductRepo: ISupplierProductRepository,
  catalogSkuLookup: ICatalogSkuLookupPort,
  supplierProductQty: ISupplierProductQtyReadPort,
  factorySendCatalog: IFactorySendCatalogPort,
  inventoryUncovered: IInventoryUncoveredReadPort,
  committedCustomerNames: ICommittedCustomerNamesPort,
  supplierSkuMapping: ISupplierSkuMappingReadPort,
  caseQty: import("@dc-inventory/inventory").IUncoveredCaseQtyReadPort,
  uncoveredList: import("@dc-inventory/inventory").IUncoveredListQuery,
  unitOfWork: IUnitOfWork,
  clock: import("@dc-inventory/purchasing").IClock,
): PurchasingHttpServices {
  const workbookWriter = new ExcelJsWorkbookWriter();
  const createPurchaseOrder = new CreatePurchaseOrderUseCase(
    purchaseOrderRepo,
    supplierRepo,
    catalogSkuLookup,
    clock,
  );
  const replacePurchaseOrderLines = new ReplacePurchaseOrderLinesUseCase(
    purchaseOrderRepo,
    catalogSkuLookup,
  );
  return {
    listPurchaseOrders: new ListPurchaseOrdersUseCase(purchaseOrderRepo, supplierRepo),
    createPurchaseOrder,
    getPurchaseOrder: new GetPurchaseOrderUseCase(purchaseOrderRepo),
    getPurchaseOrderByDocumentNumber: new GetPurchaseOrderByDocumentNumberUseCase(
      purchaseOrderRepo,
    ),
    confirmPurchaseOrder: new ConfirmPurchaseOrderUseCase(
      unitOfWork.purchasing,
      catalogSkuLookup,
    ),
    receivePurchaseOrder: new ReceivePurchaseOrderUseCase(unitOfWork.purchasing),
    replacePurchaseOrderLines,
    exportPurchaseOrder: new ExportPurchaseOrderUseCase(
      purchaseOrderRepo,
      supplierProductRepo,
      factorySendCatalog,
      workbookWriter,
    ),
    getPurchaseOrderFactorySend: new GetPurchaseOrderFactorySendUseCase(
      purchaseOrderRepo,
      supplierProductRepo,
      factorySendCatalog,
    ),
    getPurchaseOrderShortReadout: new GetPurchaseOrderShortReadoutUseCase(
      purchaseOrderRepo,
      inventoryUncovered,
      committedCustomerNames,
    ),
    cancelPurchaseOrder: new CancelPurchaseOrderUseCase(unitOfWork.purchasing),
    cancelRemainingPurchaseOrder: new CancelRemainingPurchaseOrderUseCase(unitOfWork.purchasing),
    listSuppliers: new ListSuppliersUseCase(supplierRepo),
    createSupplier: new CreateSupplierUseCase(supplierRepo),
    getSupplier: new GetSupplierUseCase(supplierRepo),
    updateSupplier: new UpdateSupplierUseCase(supplierRepo),
    listSupplierProducts: new ListSupplierProductsUseCase(
      supplierRepo,
      supplierProductRepo,
      catalogSkuLookup,
      supplierProductQty,
      factorySendCatalog,
    ),
    assignSupplierProduct: new AssignSupplierProductUseCase(
      supplierRepo,
      supplierProductRepo,
      catalogSkuLookup,
    ),
    updateSupplierProduct: new UpdateSupplierProductUseCase(supplierRepo, supplierProductRepo),
    unlinkSupplierProduct: new UnlinkSupplierProductUseCase(supplierRepo, supplierProductRepo),
    draftPurchaseOrdersFromUncoveredSkus: new DraftPurchaseOrdersFromUncoveredSkusUseCase(
      supplierSkuMapping,
      inventoryUncovered,
      caseQty,
      unitOfWork.purchasing,
      catalogSkuLookup,
      clock,
    ),
    syncDraftPurchaseOrdersFromUncovered: new SyncDraftPurchaseOrdersFromUncoveredUseCase(
      purchaseOrderRepo,
      supplierSkuMapping,
      uncoveredList,
      caseQty,
      inventoryUncovered,
      replacePurchaseOrderLines,
    ),
  };
}

function customerLookupPort(
  customerRepo: ICustomerRepository,
  accountStatus: ICustomerAccountStatusReadPort,
): ICustomerLookupPort {
  return {
    findById: async (organizationId, id) => {
      const customer = await customerRepo.findById(organizationId, id);
      if (customer === null) {
        return null;
      }
      const status = await accountStatus.getAccountStatus(organizationId, id);
      return {
        id: customer.id,
        accountStatus: status ?? customer.accountStatus,
      };
    },
  };
}

function salesServices(
  salesOrderRepo: ISalesOrderRepository,
  customerRepo: ICustomerRepository,
  catalogProduct: ICatalogProductPort,
  unitOfWork: IUnitOfWork,
  clock: import("@dc-inventory/sales").IClock,
  billToSnapshot: ICustomerBillToSnapshotReadPort,
  shipToSnapshot: ICustomerShipToSnapshotReadPort,
  accountStatus: ICustomerAccountStatusReadPort,
): SalesHttpServices {
  const customers = customerLookupPort(customerRepo, accountStatus);
  return {
    listSalesOrders: new ListSalesOrdersUseCase(salesOrderRepo),
    createSalesOrder: new CreateSalesOrderUseCase(
      salesOrderRepo,
      customers,
      catalogProduct,
      clock,
    ),
    replaceSalesOrderLines: new ReplaceSalesOrderLinesUseCase(
      salesOrderRepo,
      customers,
      catalogProduct,
    ),
    getSalesOrder: new GetSalesOrderUseCase(salesOrderRepo),
    confirmSalesOrder: new ConfirmSalesOrderUseCase(unitOfWork.sales, customers, shipToSnapshot),
    cancelSalesOrder: new CancelSalesOrderUseCase(unitOfWork.sales),
    shipSalesOrder: new ShipSalesOrderUseCase(unitOfWork.sales, billToSnapshot),
  };
}

function accountingServices(
  invoiceRepo: IInvoiceRepository,
  accountingUnitOfWork: import("@dc-inventory/accounting").IAccountingUnitOfWork,
  clock: import("@dc-inventory/accounting").IClock,
): AccountingHttpServices {
  return {
    getInvoice: new GetInvoiceUseCase(invoiceRepo),
    recordPayment: new RecordPaymentUseCase(accountingUnitOfWork, clock),
  };
}

function licensingServices(repository: ILicensingReadRepository): LicensingHttpServices {
  return {
    listSubscriptions: new ListLicensingSubscriptionsUseCase(repository),
    listPayments: new ListLicensingPaymentsUseCase(repository),
  };
}

function inventoryServices(
  unitOfWork: IUnitOfWork,
  purchaseOrderRepo: IPurchaseOrderRepository,
  uncoveredList: IUncoveredListQuery,
  listUncoveredSkus: ListUncoveredSkusUseCase,
  listUncoveredFactories: ListUncoveredFactoriesUseCase,
  sellWindowRepo: ISellWindowRepository,
  clock: import("@dc-inventory/inventory").IClock,
): InventoryHttpServices {
  return {
    getStockSnapshot: new GetStockSnapshotUseCase(unitOfWork.inventory.readModel),
    listPurchaseOrderGoodsReceived: new ListPurchaseOrderGoodsReceivedUseCase(
      unitOfWork.inventory.readModel,
      new PurchaseOrderLookupAdapter(purchaseOrderRepo),
    ),
    listUncoveredSkus,
    listUncoveredFactories,
    reopenSkusForPresell: {
      execute: (input: RecordReopenSkusForPresellRequest) =>
        unitOfWork.run((scope) =>
          new RecordReopenSkusForPresellUseCase(
            scope.inventory.ledger,
            new CreateSellWindowUseCase(sellWindowRepo, clock),
          ).execute(input),
        ),
    },
    listSellWindows: new ListSellWindowsUseCase(sellWindowRepo, clock),
    getSellWindow: new GetSellWindowUseCase(sellWindowRepo, clock),
    createSellWindow: new CreateSellWindowUseCase(sellWindowRepo, clock),
    closeSellWindow: new CloseSellWindowUseCase(sellWindowRepo, clock),
  };
}

export function composeAppServices(
  overrides: AppServiceOverrides = {},
): AppServices {
  const clock = overrides.clock ?? new SystemClock();

  let database: IDatabase;
  let identityDb: IdentityDrizzle | undefined;
  let customersDb: CustomersDrizzle | undefined;
  let catalogDb: CatalogDrizzle | undefined;
  let purchasingDb: PurchasingDrizzle | undefined;
  let salesDb: SalesDrizzle | undefined;
  let accountingDb: AccountingDrizzle | undefined;
  let licensingDb: LicensingDrizzle | undefined;
  let appDb: AppDrizzle | undefined;
  if (overrides.database) {
    database = overrides.database;
  } else {
    const connection = createDatabaseConnection();
    database = new PostgresDatabase(connection.sql);
    identityDb = connection.db as unknown as IdentityDrizzle;
    customersDb = connection.db as unknown as CustomersDrizzle;
    catalogDb = connection.db as unknown as CatalogDrizzle;
    purchasingDb = connection.db as unknown as PurchasingDrizzle;
    salesDb = connection.db as unknown as SalesDrizzle;
    accountingDb = connection.db as unknown as AccountingDrizzle;
    licensingDb = connection.db as unknown as LicensingDrizzle;
    appDb = connection.db;
  }

  const inMemoryLicensing =
    overrides.licensingStore ??
    (licensingDb || overrides.licensingRepository
      ? undefined
      : new InMemoryLicensingStore());
  const licensingRepository =
    overrides.licensingRepository ??
    (licensingDb
      ? new DrizzleLicensingReadRepository(licensingDb)
      : inMemoryLicensing!);
  const features =
    overrides.features ??
    (readFeaturesAllCoreOn() || !licensingDb
      ? featuresAllCoreOn()
      : new LicensingFeatures(licensingRepository));

  const staffUsers =
    overrides.staffUsers ??
    (identityDb
      ? new DrizzleStaffUserRepository(identityDb)
      : new InMemoryStaffUserRepository());
  const opsUsers =
    overrides.opsUsers ??
    (identityDb
      ? new DrizzleOpsUserRepository(identityDb)
      : new InMemoryOpsUserRepository());
  const wholesaleUsers =
    overrides.wholesaleUsers ??
    (identityDb
      ? new DrizzleWholesaleUserRepository(identityDb)
      : new InMemoryWholesaleUserRepository());
  const sessions =
    overrides.sessions ??
    (identityDb ? new DrizzleSessionStore(identityDb) : new InMemorySessionStore());
  const passwords =
    overrides.passwords ??
    (identityDb ? new ScryptPasswordHasher() : new InMemoryPasswordHasher());
  const organizationRepo =
    overrides.organizationRepo ??
    (identityDb
      ? new DrizzleOrganizationRepository(identityDb)
      : new InMemoryOrganizationRepository());
  const loginThrottle =
    overrides.loginThrottle ??
    (identityDb
      ? new DrizzleLoginThrottle(identityDb, clock)
      : new InMemoryLoginThrottle(clock));

  const customerRepo =
    overrides.customerRepo ??
    (customersDb
      ? new DrizzleCustomerRepository(customersDb)
      : new InMemoryCustomerRepository());
  const contactRepo =
    overrides.contactRepo ??
    (customersDb
      ? new DrizzleContactRepository(customersDb)
      : new InMemoryContactRepository());
  const shipToRepo =
    overrides.shipToRepo ??
    (customersDb
      ? new DrizzleShipToRepository(customersDb)
      : new InMemoryShipToRepository());
  const exemptionRepo =
    overrides.exemptionRepo ??
    (customersDb
      ? new DrizzleExemptionCertificateRepository(customersDb)
      : new InMemoryExemptionCertificateRepository());
  const billToRepo =
    overrides.billToRepo ??
    (customersDb
      ? new DrizzleBillToRepository(customersDb)
      : new InMemoryBillToRepository());

  const readPorts = customerReadPorts(customerRepo, billToRepo, shipToRepo);
  const customerTermsRead = new CustomerTermsReadAdapter(customerRepo);

  const productRepo =
    overrides.productRepo ??
    (catalogDb
      ? new DrizzleProductRepository(catalogDb)
      : new InMemoryProductRepository());
  const productPackagingRepo =
    overrides.productPackagingRepo ??
    (catalogDb
      ? new DrizzleProductPackagingRepository(catalogDb)
      : new InMemoryProductPackagingRepository());
  const productCategoryRepo =
    overrides.productCategoryRepo ??
    (catalogDb
      ? new DrizzleProductCategoryRepository(catalogDb)
      : new InMemoryProductCategoryRepository(
          productRepo instanceof InMemoryProductRepository
            ? productRepo
            : new InMemoryProductRepository(),
        ));
  const productIdentifierRepo =
    overrides.productIdentifierRepo ??
    (catalogDb
      ? new DrizzleProductIdentifierRepository(catalogDb)
      : new InMemoryProductIdentifierRepository());
  const importLocationPort =
    overrides.importLocationPort ??
    (appDb
      ? new DrizzleImportLocationAdapter(appDb)
      : new InMemoryImportLocationPort());
  const inMemoryReorderPolicies =
    appDb === undefined
      ? (overrides.productReorderRead ??
        overrides.importReorderPolicyPort ??
        new InMemoryProductReorderReadPort())
      : undefined;
  const importReorderPolicyPort =
    overrides.importReorderPolicyPort ??
    (appDb
      ? new DrizzleImportReorderPolicyAdapter(appDb)
      : (inMemoryReorderPolicies as InMemoryProductReorderReadPort));
  const unitOfWork =
    overrides.unitOfWork ??
    (appDb
      ? new PostgresInventoryUnitOfWork(
          appDb,
          clock,
          readPorts.billToSnapshot,
          customerTermsRead,
        )
      : new InMemoryUnitOfWork(readPorts.billToSnapshot, customerTermsRead, clock));

  const inMemoryUow = unitOfWork instanceof InMemoryUnitOfWork ? unitOfWork : null;

  const qtyRead =
    overrides.qtyRead ??
    (appDb
      ? new StockSnapshotQtyReadAdapter(appDb, clock)
      : inMemoryUow
        ? new InventoryReadModelQtyReadAdapter(inMemoryUow.inventory.readModel)
        : new InMemoryQtyReadPort());
  const catalogListQuery =
    overrides.catalogListQuery ??
    (appDb
      ? new CatalogInventoryListQuery(appDb, clock)
      : new InMemoryCatalogListQuery(productRepo, qtyRead, productPackagingRepo));

  const purchaseOrderRepo =
    overrides.purchaseOrderRepo ??
    (purchasingDb
      ? new DrizzlePurchaseOrderRepository(purchasingDb)
      : unitOfWork.purchasing.purchaseOrders);
  const supplierRepo =
    overrides.supplierRepo ??
    (purchasingDb ? new DrizzleSupplierRepository(purchasingDb) : unitOfWork.purchasing.suppliers);
  const supplierProductRepo =
    overrides.supplierProductRepo ??
    (purchasingDb
      ? new DrizzleSupplierProductRepository(purchasingDb)
      : new InMemorySupplierProductRepository());
  const productPrimarySupplierRead =
    overrides.productPrimarySupplierRead ??
    (purchasingDb
      ? new PurchasingProductPrimarySupplierReadAdapter(purchasingDb)
      : supplierProductRepo instanceof InMemorySupplierProductRepository
        ? new InMemoryPurchasingProductPrimarySupplierReadAdapter(
            supplierRepo,
            supplierProductRepo,
          )
        : new InMemoryProductPrimarySupplierReadPort());
  const productReorderRead =
    overrides.productReorderRead ??
    (appDb
      ? new DrizzleProductReorderReadAdapter(appDb)
      : (inMemoryReorderPolicies as InMemoryProductReorderReadPort));
  const catalogSkuLookup =
    overrides.catalogSkuLookup ?? catalogSkuLookupPort(productRepo);
  const factorySendCatalog =
    overrides.factorySendCatalog ?? factorySendCatalogPort(productRepo, productPackagingRepo);
  const supplierProductQty =
    overrides.supplierProductQtyRead ?? supplierProductQtyReadPort(qtyRead);
  const supplierSkuMapping =
    overrides.supplierSkuMapping ??
    (purchasingDb
      ? supplierSkuMappingReadPort(purchasingDb)
      : new InMemorySupplierSkuMappingReadPort(
          supplierRepo,
          supplierProductRepo as InMemorySupplierProductRepository,
        ));

  const salesOrderRepo =
    overrides.salesOrderRepo ??
    (salesDb ? new DrizzleSalesOrderRepository(salesDb) : unitOfWork.sales.salesOrders);

  const committedCustomerNamesListQuery =
    salesDb !== undefined
      ? new DrizzleCommittedCustomerNamesListQuery(salesDb)
      : new InMemoryCommittedCustomerNamesListQuery(
          salesOrderRepo as InMemorySalesOrderRepository,
          customerRepo,
        );

  const defaultInMemoryAccountingUow = new InMemoryAccountingUnitOfWork();

  const accountingUnitOfWork =
    overrides.accountingUnitOfWork ??
    (appDb
      ? new PostgresAccountingUnitOfWork(appDb)
      : inMemoryUow
        ? new InMemoryAccountingUnitOfWork(inMemoryUow.invoices)
        : defaultInMemoryAccountingUow);

  const invoiceRepo =
    overrides.invoiceRepo ??
    (accountingDb
      ? new DrizzleInvoiceRepository(accountingDb)
      : inMemoryUow
        ? inMemoryUow.invoices
        : defaultInMemoryAccountingUow.invoices);

  const wholesaleAccountStatus = wholesaleLoginAccountStatusReadPort(readPorts.accountStatus);
  const actingCustomerHeaders = actingCustomerHeaderReadPort(customerRepo);

  const uncoveredList =
    overrides.uncoveredList ??
    (appDb
      ? new UncoveredInventoryListQuery(appDb)
      : new InMemoryUncoveredListQuery(
          unitOfWork.inventory.readModel as InMemoryInventoryReadModel,
        ));
  const uncoveredCaseQty =
    overrides.uncoveredCaseQtyRead ??
    (productRepo && productPackagingRepo
      ? uncoveredCaseQtyReadPort(productRepo, productPackagingRepo)
      : new InMemoryUncoveredCaseQtyReadPort());
  const uncoveredReorderPolicy =
    overrides.uncoveredReorderPolicyRead ??
    (appDb
      ? uncoveredReorderPolicyReadPort(appDb)
      : new InMemoryUncoveredReorderPolicyReadPort());
  const openDraftPurchaseOrderRead =
    overrides.openDraftPurchaseOrderRead ??
    (purchasingDb
      ? uncoveredOpenDraftPurchaseOrderReadPort(purchasingDb)
      : inMemoryUncoveredOpenDraftPurchaseOrderReadPort(purchaseOrderRepo));
  const uncoveredSkuSupplierMapping = uncoveredSkuSupplierMappingReadPort(supplierSkuMapping);
  const uncoveredSkuSupplier = uncoveredSkuSupplierReadPort(supplierRepo);
  const uncoveredSkuDraftPurchaseOrder = uncoveredSkuDraftPurchaseOrderReadPort(
    openDraftPurchaseOrderRead,
  );
  const listUncoveredSkus = new ListUncoveredSkusUseCase(
    uncoveredList,
    uncoveredCaseQty,
    uncoveredReorderPolicy,
    uncoveredSkuSupplierMapping,
    uncoveredSkuSupplier,
    uncoveredSkuDraftPurchaseOrder,
  );
  const listUncoveredFactories = new ListUncoveredFactoriesUseCase(
    uncoveredList,
    uncoveredSkuSupplierMapping,
    uncoveredSkuSupplier,
    uncoveredSkuDraftPurchaseOrder,
  );
  const sellWindowRepo =
    overrides.sellWindowRepo ??
    (appDb ? new DrizzleSellWindowRepository(appDb) : new InMemorySellWindowRepository());

  return {
    features,
    clock,
    database,
    ping: new PingUseCase(clock),
    ready: new ReadyCheckUseCase(database),
    identity: {
      loginOps: new LoginOpsUseCase(
        organizationRepo,
        opsUsers,
        sessions,
        passwords,
        clock,
      ),
      loginThrottle,
      logoutOps: new LogoutUseCase(sessions, clock, "ops"),
      resolveOps: new ResolveOpsSessionUseCase(sessions, opsUsers, clock),
      loginStaff: new LoginStaffUseCase(
        organizationRepo,
        staffUsers,
        sessions,
        passwords,
        clock,
      ),
      loginWholesale: new LoginWholesaleUseCase(
        organizationRepo,
        wholesaleUsers,
        staffUsers,
        sessions,
        passwords,
        clock,
        wholesaleAccountStatus,
      ),
      logoutStaff: new LogoutUseCase(sessions, clock, "staff"),
      logoutWholesale: new LogoutUseCase(sessions, clock, "wholesale"),
      resolveStaff: new ResolveStaffSessionUseCase(sessions, staffUsers, clock),
      resolveWholesale: new ResolveWholesaleSessionUseCase(
        sessions,
        wholesaleUsers,
        staffUsers,
        clock,
      ),
      listActingCustomers: new ListActingCustomersUseCase(
        sessions,
        staffUsers,
        wholesaleUsers,
        actingCustomerHeaders,
        wholesaleAccountStatus,
        clock,
      ),
      selectActingCustomer: new SelectActingCustomerUseCase(
        sessions,
        staffUsers,
        wholesaleUsers,
        actingCustomerHeaders,
        wholesaleAccountStatus,
        clock,
      ),
      clearActingCustomer: new ClearActingCustomerUseCase(sessions, staffUsers, clock),
    },
    customers: customersServices(
      customerRepo,
      contactRepo,
      shipToRepo,
      billToRepo,
      exemptionRepo,
    ),
    customerReadPorts: readPorts,
    catalog: catalogServices(
      productRepo,
      qtyRead,
      catalogListQuery,
      new PurchasingSupplierLinkAdapter(supplierRepo, supplierProductRepo, catalogSkuLookup),
      productPackagingRepo,
      productCategoryRepo,
      productIdentifierRepo,
      productPrimarySupplierRead,
      productReorderRead,
      importLocationPort,
      importReorderPolicyPort,
    ),
    purchasing: purchasingServices(
      purchaseOrderRepo,
      supplierRepo,
      supplierProductRepo,
      catalogSkuLookup,
      supplierProductQty,
      factorySendCatalog,
      inventoryUncoveredReadPort(unitOfWork.inventory.readModel),
      committedCustomerNamesPort(committedCustomerNamesListQuery),
      supplierSkuMapping,
      uncoveredCaseQty,
      uncoveredList,
      unitOfWork,
      clock,
    ),
    sales: salesServices(
      salesOrderRepo,
      customerRepo,
      overrides.catalogProduct ?? catalogProductPort(productRepo, qtyRead),
      unitOfWork,
      clock,
      readPorts.billToSnapshot,
      readPorts.shipToSnapshot,
      readPorts.accountStatus,
    ),
    accounting: accountingServices(invoiceRepo, accountingUnitOfWork, clock),
    licensing: licensingServices(licensingRepository),
    inventory: inventoryServices(
      unitOfWork,
      purchaseOrderRepo,
      uncoveredList,
      listUncoveredSkus,
      listUncoveredFactories,
      sellWindowRepo,
      clock,
    ),
    unitOfWork,
  };
}
