import {
  CreateProductUseCase,
  DrizzleProductRepository,
  GetProductUseCase,
  GetWholesaleProductUseCase,
  InMemoryProductRepository,
  InMemoryQtyReadPort,
  ListStaffProductsUseCase,
  ListWholesaleCatalogUseCase,
  UpdateProductUseCase,
  type CatalogDrizzle,
  type IProductRepository,
  type IQtyReadPort,
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
  type IPasswordHasher,
  type ISessionStore,
  type IStaffUserRepository,
  type IWholesaleUserRepository,
  type IdentityDrizzle,
} from "@dc-inventory/identity";
import { StockSnapshotQtyReadAdapter } from "../adapters/stock-snapshot-qty-read.js";
import { SystemClock } from "../adapters/system-clock.js";
import type { AppDrizzle } from "./db.js";
import { PingUseCase } from "../application/ping.js";
import { ReadyCheckUseCase } from "../application/ready.js";
import type { IClock } from "../domain/clock.js";
import type { IDatabase } from "../domain/database.js";
import { featuresAllCoreOn, type IFeatures } from "../features.js";
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
};

export type AppServiceOverrides = {
  features?: IFeatures;
  clock?: IClock;
  database?: IDatabase;
  staffUsers?: IStaffUserRepository;
  wholesaleUsers?: IWholesaleUserRepository;
  sessions?: ISessionStore;
  passwords?: IPasswordHasher;
  customerRepo?: ICustomerRepository;
  contactRepo?: IContactRepository;
  shipToRepo?: IShipToRepository;
  exemptionRepo?: IExemptionCertificateRepository;
  productRepo?: IProductRepository;
  qtyRead?: IQtyReadPort;
};

function catalogServices(
  productRepo: IProductRepository,
  qtyRead: IQtyReadPort,
): CatalogHttpServices {
  return {
    listStaffProducts: new ListStaffProductsUseCase(productRepo, qtyRead),
    createProduct: new CreateProductUseCase(productRepo),
    getProduct: new GetProductUseCase(productRepo, qtyRead),
    updateProduct: new UpdateProductUseCase(productRepo, qtyRead),
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

export function composeAppServices(
  overrides: AppServiceOverrides = {},
): AppServices {
  const features = overrides.features ?? featuresAllCoreOn();
  const clock = overrides.clock ?? new SystemClock();

  let database: IDatabase;
  let identityDb: IdentityDrizzle | undefined;
  let customersDb: CustomersDrizzle | undefined;
  let catalogDb: CatalogDrizzle | undefined;
  let appDb: AppDrizzle | undefined;
  if (overrides.database) {
    database = overrides.database;
  } else {
    const connection = createDatabaseConnection();
    database = new PostgresDatabase(connection.sql);
    identityDb = connection.db as unknown as IdentityDrizzle;
    customersDb = connection.db as unknown as CustomersDrizzle;
    catalogDb = connection.db as unknown as CatalogDrizzle;
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
  const qtyRead =
    overrides.qtyRead ??
    (appDb ? new StockSnapshotQtyReadAdapter(appDb) : new InMemoryQtyReadPort());

  return {
    features,
    clock,
    database,
    ping: new PingUseCase(clock),
    ready: new ReadyCheckUseCase(database),
    identity: {
      loginStaff: new LoginStaffUseCase(staffUsers, sessions, passwords, clock),
      loginWholesale: new LoginWholesaleUseCase(
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
    catalog: catalogServices(productRepo, qtyRead),
  };
}
