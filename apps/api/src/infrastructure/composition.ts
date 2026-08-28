import {
  CreateProductUseCase,
  DrizzleProductPackagingRepository,
  DrizzleProductRepository,
  GetProductUseCase,
  GetWholesaleProductUseCase,
  ImportProductBrowserUseCase,
  InMemoryProductPackagingRepository,
  InMemoryProductRepository,
  InMemoryQtyReadPort,
  ListStaffProductsUseCase,
  ListWholesaleCatalogUseCase,
  UpdateProductUseCase,
  type CatalogDrizzle,
  type IProductPackagingRepository,
  type IProductRepository,
  type IQtyReadPort,
  type ISupplierLinkPort,
} from "@dc-inventory/catalog";
import {
  CreateContactUseCase,
  CreateCustomerUseCase,
  CreateExemptionCertificateUseCase,
  CreateShipToUseCase,
  DrizzleContactRepository,
  DrizzleCustomerRepository,
  DrizzleExemptionCertificateRepository,
  DrizzleShipToRepository,
  GetCustomerUseCase,
  InMemoryContactRepository,
  InMemoryCustomerRepository,
  InMemoryExemptionCertificateRepository,
  InMemoryShipToRepository,
  ListContactsUseCase,
  ListCustomersUseCase,
  ListExemptionCertificatesUseCase,
  ListShipTosUseCase,
  UpdateContactUseCase,
  UpdateCustomerUseCase,
  UpdateExemptionCertificateUseCase,
  UpdateShipToUseCase,
  type CustomersDrizzle,
  type IContactRepository,
  type ICustomerRepository,
  type IExemptionCertificateRepository,
  type IShipToRepository,
} from "@dc-inventory/customers";
import {
  DrizzleSessionStore,
  DrizzleStaffUserRepository,
  DrizzleWholesaleUserRepository,
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
  ScryptPasswordHasher,
  DrizzleOrganizationRepository,
  type IPasswordHasher,
  type IOrganizationRepository,
  type ISessionStore,
  type IStaffUserRepository,
  type IWholesaleUserRepository,
  type IdentityDrizzle,
} from "@dc-inventory/identity";
import {
  AssignSupplierProductUseCase,
  CancelPurchaseOrderUseCase,
  ConfirmPurchaseOrderUseCase,
  CreatePurchaseOrderUseCase,
  CreateSupplierUseCase,
  DrizzlePurchaseOrderRepository,
  DrizzleSupplierProductRepository,
  DrizzleSupplierRepository,
  ExportPurchaseOrderUseCase,
  ExcelJsWorkbookWriter,
  GetPurchaseOrderUseCase,
  GetSupplierUseCase,
  InMemoryPurchaseOrderRepository,
  InMemorySupplierProductRepository,
  InMemorySupplierRepository,
  ListPurchaseOrdersUseCase,
  ListSupplierProductsUseCase,
  ListSuppliersUseCase,
  ReceivePurchaseOrderUseCase,
  ReplacePurchaseOrderLinesUseCase,
  UnlinkSupplierProductUseCase,
  UpdateSupplierProductUseCase,
  UpdateSupplierUseCase,
  type ICatalogSkuLookupPort,
  type IFactorySendCatalogPort,
  type IPurchaseOrderRepository,
  type ISupplierProductQtyReadPort,
  type ISupplierProductRepository,
  type ISupplierRepository,
  type PurchasingDrizzle,
} from "@dc-inventory/purchasing";
import {
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
  DrizzleSalesOrderRepository,
  GetSalesOrderUseCase,
  InMemorySalesOrderRepository,
  ListSalesOrdersUseCase,
  ShipSalesOrderUseCase,
  type ICustomerLookupPort,
  type ISalesOrderRepository,
  type SalesDrizzle,
} from "@dc-inventory/sales";
import { OrganizationId } from "@dc-inventory/shared-kernel";
import { InMemoryUnitOfWork } from "../adapters/in-memory-unit-of-work.js";
import { PostgresAccountingUnitOfWork } from "../adapters/postgres-accounting-unit-of-work.js";
import { PostgresInventoryUnitOfWork } from "../adapters/postgres-inventory-unit-of-work.js";
import { InventoryReadModelQtyReadAdapter } from "../adapters/inventory-read-model-qty-read.js";
import { PurchasingSupplierLinkAdapter } from "../adapters/purchasing-supplier-link.js";
import {
  catalogSkuLookupPort,
  factorySendCatalogPort,
  supplierProductQtyReadPort,
} from "../adapters/purchasing-catalog-ports.js";
import { StockSnapshotQtyReadAdapter } from "../adapters/stock-snapshot-qty-read.js";
import { SystemClock } from "../adapters/system-clock.js";
import type { IUnitOfWork } from "../domain/unit-of-work.js";
import type { AppDrizzle } from "./db.js";
import { PingUseCase } from "../application/ping.js";
import { ReadyCheckUseCase } from "../application/ready.js";
import {
  ListLicensingPaymentsUseCase,
  ListLicensingSubscriptionsUseCase,
} from "../application/list-licensing.js";
import type { IClock } from "../domain/clock.js";
import type { IDatabase } from "../domain/database.js";
import { featuresAllCoreOn, type IFeatures } from "../features.js";
import { InMemoryLicensingStore } from "../licensing/in-memory-licensing.js";
import { createDatabaseConnection, PostgresDatabase } from "./db.js";

export type IdentityHttpServices = {
  loginStaff: LoginStaffUseCase;
  loginWholesale: LoginWholesaleUseCase;
  logoutStaff: LogoutUseCase;
  logoutWholesale: LogoutUseCase;
  resolveStaff: ResolveStaffSessionUseCase;
  resolveWholesale: ResolveWholesaleSessionUseCase;
};

export type CatalogHttpServices = {
  listStaffProducts: ListStaffProductsUseCase;
  createProduct: CreateProductUseCase;
  getProduct: GetProductUseCase;
  updateProduct: UpdateProductUseCase;
  importProductBrowser: ImportProductBrowserUseCase;
  listWholesaleCatalog: ListWholesaleCatalogUseCase;
  getWholesaleProduct: GetWholesaleProductUseCase;
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
};

export type PurchasingHttpServices = {
  listPurchaseOrders: ListPurchaseOrdersUseCase;
  createPurchaseOrder: CreatePurchaseOrderUseCase;
  getPurchaseOrder: GetPurchaseOrderUseCase;
  confirmPurchaseOrder: ConfirmPurchaseOrderUseCase;
  receivePurchaseOrder: ReceivePurchaseOrderUseCase;
  replacePurchaseOrderLines: ReplacePurchaseOrderLinesUseCase;
  exportPurchaseOrder: ExportPurchaseOrderUseCase;
  cancelPurchaseOrder: CancelPurchaseOrderUseCase;
  listSuppliers: ListSuppliersUseCase;
  createSupplier: CreateSupplierUseCase;
  getSupplier: GetSupplierUseCase;
  updateSupplier: UpdateSupplierUseCase;
  listSupplierProducts: ListSupplierProductsUseCase;
  assignSupplierProduct: AssignSupplierProductUseCase;
  updateSupplierProduct: UpdateSupplierProductUseCase;
  unlinkSupplierProduct: UnlinkSupplierProductUseCase;
};

export type SalesHttpServices = {
  listSalesOrders: ListSalesOrdersUseCase;
  createSalesOrder: CreateSalesOrderUseCase;
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
  catalog: CatalogHttpServices;
  purchasing: PurchasingHttpServices;
  sales: SalesHttpServices;
  accounting: AccountingHttpServices;
  licensing: LicensingHttpServices;
  unitOfWork: IUnitOfWork;
  licensingStore: InMemoryLicensingStore;
};

export type AppServiceOverrides = {
  features?: IFeatures;
  clock?: IClock;
  database?: IDatabase;
  staffUsers?: IStaffUserRepository;
  wholesaleUsers?: IWholesaleUserRepository;
  sessions?: ISessionStore;
  passwords?: IPasswordHasher;
  organizationRepo?: IOrganizationRepository;
  customerRepo?: ICustomerRepository;
  contactRepo?: IContactRepository;
  shipToRepo?: IShipToRepository;
  exemptionRepo?: IExemptionCertificateRepository;
  productRepo?: IProductRepository;
  productPackagingRepo?: IProductPackagingRepository;
  qtyRead?: IQtyReadPort;
  purchaseOrderRepo?: IPurchaseOrderRepository;
  supplierRepo?: ISupplierRepository;
  supplierProductRepo?: ISupplierProductRepository;
  catalogSkuLookup?: ICatalogSkuLookupPort;
  factorySendCatalog?: IFactorySendCatalogPort;
  supplierProductQtyRead?: ISupplierProductQtyReadPort;
  salesOrderRepo?: ISalesOrderRepository;
  invoiceRepo?: IInvoiceRepository;
  accountingUnitOfWork?: import("@dc-inventory/accounting").IAccountingUnitOfWork;
  unitOfWork?: IUnitOfWork;
  licensingStore?: InMemoryLicensingStore;
};

function catalogServices(
  productRepo: IProductRepository,
  qtyRead: IQtyReadPort,
  supplierLink: ISupplierLinkPort,
  packaging: IProductPackagingRepository,
): CatalogHttpServices {
  const createProduct = new CreateProductUseCase(productRepo);
  const updateProduct = new UpdateProductUseCase(productRepo, qtyRead);
  return {
    listStaffProducts: new ListStaffProductsUseCase(productRepo, qtyRead),
    createProduct,
    getProduct: new GetProductUseCase(productRepo, qtyRead),
    updateProduct,
    importProductBrowser: new ImportProductBrowserUseCase(
      productRepo,
      createProduct,
      updateProduct,
      supplierLink,
      packaging,
    ),
    listWholesaleCatalog: new ListWholesaleCatalogUseCase(productRepo, qtyRead),
    getWholesaleProduct: new GetWholesaleProductUseCase(productRepo, qtyRead),
  };
}

function customersServices(
  customerRepo: ICustomerRepository,
  contactRepo: IContactRepository,
  shipToRepo: IShipToRepository,
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
  };
}

function purchasingServices(
  purchaseOrderRepo: IPurchaseOrderRepository,
  supplierRepo: ISupplierRepository,
  supplierProductRepo: ISupplierProductRepository,
  catalogSkuLookup: ICatalogSkuLookupPort,
  supplierProductQty: ISupplierProductQtyReadPort,
  factorySendCatalog: IFactorySendCatalogPort,
  unitOfWork: IUnitOfWork,
  clock: import("@dc-inventory/purchasing").IClock,
): PurchasingHttpServices {
  const workbookWriter = new ExcelJsWorkbookWriter();
  return {
    listPurchaseOrders: new ListPurchaseOrdersUseCase(purchaseOrderRepo),
    createPurchaseOrder: new CreatePurchaseOrderUseCase(purchaseOrderRepo, supplierRepo, clock),
    getPurchaseOrder: new GetPurchaseOrderUseCase(purchaseOrderRepo),
    confirmPurchaseOrder: new ConfirmPurchaseOrderUseCase(unitOfWork.purchasing),
    receivePurchaseOrder: new ReceivePurchaseOrderUseCase(unitOfWork.purchasing),
    replacePurchaseOrderLines: new ReplacePurchaseOrderLinesUseCase(purchaseOrderRepo),
    exportPurchaseOrder: new ExportPurchaseOrderUseCase(
      purchaseOrderRepo,
      supplierProductRepo,
      factorySendCatalog,
      workbookWriter,
    ),
    cancelPurchaseOrder: new CancelPurchaseOrderUseCase(unitOfWork.purchasing),
    listSuppliers: new ListSuppliersUseCase(supplierRepo),
    createSupplier: new CreateSupplierUseCase(supplierRepo),
    getSupplier: new GetSupplierUseCase(supplierRepo),
    updateSupplier: new UpdateSupplierUseCase(supplierRepo),
    listSupplierProducts: new ListSupplierProductsUseCase(
      supplierRepo,
      supplierProductRepo,
      catalogSkuLookup,
      supplierProductQty,
    ),
    assignSupplierProduct: new AssignSupplierProductUseCase(
      supplierRepo,
      supplierProductRepo,
      catalogSkuLookup,
    ),
    updateSupplierProduct: new UpdateSupplierProductUseCase(supplierRepo, supplierProductRepo),
    unlinkSupplierProduct: new UnlinkSupplierProductUseCase(supplierRepo, supplierProductRepo),
  };
}

function customerLookupPort(customerRepo: ICustomerRepository): ICustomerLookupPort {
  return {
    findById: async (organizationId, id) => {
      const customer = await customerRepo.findById(organizationId, id);
      return customer === null ? null : { id: customer.id };
    },
  };
}

function salesServices(
  salesOrderRepo: ISalesOrderRepository,
  customerRepo: ICustomerRepository,
  unitOfWork: IUnitOfWork,
  clock: import("@dc-inventory/sales").IClock,
): SalesHttpServices {
  return {
    listSalesOrders: new ListSalesOrdersUseCase(salesOrderRepo),
    createSalesOrder: new CreateSalesOrderUseCase(
      salesOrderRepo,
      customerLookupPort(customerRepo),
      clock,
    ),
    getSalesOrder: new GetSalesOrderUseCase(salesOrderRepo),
    confirmSalesOrder: new ConfirmSalesOrderUseCase(unitOfWork.sales),
    cancelSalesOrder: new CancelSalesOrderUseCase(unitOfWork.sales),
    shipSalesOrder: new ShipSalesOrderUseCase(unitOfWork.sales),
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

function licensingServices(store: InMemoryLicensingStore): LicensingHttpServices {
  return {
    listSubscriptions: new ListLicensingSubscriptionsUseCase(store),
    listPayments: new ListLicensingPaymentsUseCase(store),
  };
}

export function composeAppServices(
  overrides: AppServiceOverrides = {},
): AppServices {
  const features = overrides.features ?? featuresAllCoreOn();
  const clock = overrides.clock ?? new SystemClock();
  const licensingStore = overrides.licensingStore ?? new InMemoryLicensingStore();

  let database: IDatabase;
  let identityDb: IdentityDrizzle | undefined;
  let customersDb: CustomersDrizzle | undefined;
  let catalogDb: CatalogDrizzle | undefined;
  let purchasingDb: PurchasingDrizzle | undefined;
  let salesDb: SalesDrizzle | undefined;
  let accountingDb: AccountingDrizzle | undefined;
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
    appDb = connection.db;
  }

  const staffUsers =
    overrides.staffUsers ??
    (identityDb
      ? new DrizzleStaffUserRepository(identityDb)
      : new InMemoryStaffUserRepository());
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
  const unitOfWork =
    overrides.unitOfWork ??
    (appDb ? new PostgresInventoryUnitOfWork(appDb, clock) : new InMemoryUnitOfWork(clock));

  const inMemoryUow = unitOfWork instanceof InMemoryUnitOfWork ? unitOfWork : null;

  const qtyRead =
    overrides.qtyRead ??
    (appDb
      ? new StockSnapshotQtyReadAdapter(appDb)
      : inMemoryUow
        ? new InventoryReadModelQtyReadAdapter(inMemoryUow.inventory.readModel)
        : new InMemoryQtyReadPort());

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
  const catalogSkuLookup =
    overrides.catalogSkuLookup ?? catalogSkuLookupPort(productRepo);
  const factorySendCatalog =
    overrides.factorySendCatalog ?? factorySendCatalogPort(productRepo, productPackagingRepo);
  const supplierProductQty =
    overrides.supplierProductQtyRead ?? supplierProductQtyReadPort(qtyRead);

  const salesOrderRepo =
    overrides.salesOrderRepo ??
    (salesDb ? new DrizzleSalesOrderRepository(salesDb) : unitOfWork.sales.salesOrders);

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

  return {
    features,
    clock,
    database,
    ping: new PingUseCase(clock),
    ready: new ReadyCheckUseCase(database),
    identity: {
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
        sessions,
        passwords,
        clock,
      ),
      logoutStaff: new LogoutUseCase(sessions, clock, "staff"),
      logoutWholesale: new LogoutUseCase(sessions, clock, "wholesale"),
      resolveStaff: new ResolveStaffSessionUseCase(sessions, staffUsers, clock),
      resolveWholesale: new ResolveWholesaleSessionUseCase(
        sessions,
        wholesaleUsers,
        clock,
      ),
    },
    customers: customersServices(customerRepo, contactRepo, shipToRepo, exemptionRepo),
    catalog: catalogServices(
      productRepo,
      qtyRead,
      new PurchasingSupplierLinkAdapter(supplierRepo, supplierProductRepo, catalogSkuLookup),
      productPackagingRepo,
    ),
    purchasing: purchasingServices(
      purchaseOrderRepo,
      supplierRepo,
      supplierProductRepo,
      catalogSkuLookup,
      supplierProductQty,
      factorySendCatalog,
      unitOfWork,
      clock,
    ),
    sales: salesServices(salesOrderRepo, customerRepo, unitOfWork, clock),
    accounting: accountingServices(invoiceRepo, accountingUnitOfWork, clock),
    licensing: licensingServices(licensingStore),
    unitOfWork,
    licensingStore,
  };
}
