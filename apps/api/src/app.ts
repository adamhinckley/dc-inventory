import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { featuresAllCoreOn, type IFeatures } from "@dc-inventory/licensing";
import { InMemoryDatabase } from "./adapters/in-memory-database.js";
import { registerHealthRoutes } from "./adapters/http/health.js";
import { registerPingRoute } from "./adapters/http/ping.js";
import {
  assertNoWildcardOrigins,
  isAllowedCorsOrigin,
  readCorsOrigins,
} from "./adapters/http/cors-origins.js";
import type { PingUseCase } from "./application/ping.js";
import type { ReadyCheckUseCase } from "./application/ready.js";
import {
  composeAppServices,
  type AppServiceOverrides,
  type CatalogHttpServices,
  type CustomersHttpServices,
  type IdentityHttpServices,
  type PurchasingHttpServices,
  type SalesHttpServices,
  type AccountingHttpServices,
  type LicensingHttpServices,
  type InventoryHttpServices,
} from "./infrastructure/composition.js";
import { pinoLoggerOptions } from "./infrastructure/logging.js";
import { DrainState } from "./infrastructure/drain-state.js";
import {
  NoopErrorReporter,
  type IErrorReporter,
} from "./infrastructure/error-reporter.js";
import { registerErrorHandler } from "./infrastructure/error-handler.js";
import {
  registerRequestIdHook,
  requestIdConfig,
} from "./infrastructure/request-id.js";
import { internalRoutes } from "./internal/routes.js";
import { opsRoutes } from "./ops/routes.js";
import { SPREADSHEET_UPLOAD_MAX_BYTES } from "./schemas.js";
import { swaggerTransform } from "./swagger-transform.js";
import { wholesaleRoutes } from "./wholesale/routes.js";

export type Audience = "internal" | "wholesale" | "ops";

const titles: Record<Audience, string> = {
  internal: "DC Inventory internal API",
  wholesale: "DC Inventory wholesale API",
  ops: "DC Inventory ops API",
};

function applyHttpCompilers(app: FastifyInstance): void {
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
}

async function registerAudienceMounts(
  app: FastifyInstance,
  audience?: Audience,
): Promise<void> {
  if (audience === undefined || audience === "internal") {
    await app.register(internalRoutes, { prefix: "/internal" });
  }
  if (audience === undefined || audience === "wholesale") {
    await app.register(wholesaleRoutes, { prefix: "/wholesale" });
  }
  if (audience === undefined || audience === "ops") {
    await app.register(opsRoutes, { prefix: "/ops" });
  }
}

async function registerCookie(app: FastifyInstance): Promise<void> {
  await app.register(cookie);
}

async function registerMultipart(app: FastifyInstance): Promise<void> {
  await app.register(multipart, {
    limits: { fileSize: SPREADSHEET_UPLOAD_MAX_BYTES, files: 1 },
  });
}

async function registerCors(app: FastifyInstance): Promise<void> {
  const origins = readCorsOrigins();
  assertNoWildcardOrigins(origins);
  await app.register(cors, {
    origin: (origin, callback) => {
      if (origin === undefined || origin === null || origin.length === 0) {
        callback(null, true);
        return;
      }
      callback(null, isAllowedCorsOrigin(origin, origins));
    },
    credentials: true,
  });
}

export async function buildAudienceApp(
  audience: Audience,
  features: IFeatures = featuresAllCoreOn(),
): Promise<FastifyInstance> {
  const services = composeAppServices({
    features,
    database: new InMemoryDatabase(),
  });
  const app = Fastify({ logger: false });
  const drainState = new DrainState();
  const errorReporter = new NoopErrorReporter();
  app.decorate("features", features);
  app.decorate("drainState", drainState);
  app.decorate("errorReporter", errorReporter);
  app.decorate("identity", services.identity);
  app.decorate("customers", services.customers);
  app.decorate("catalog", services.catalog);
  app.decorate("purchasing", services.purchasing);
  app.decorate("sales", services.sales);
  app.decorate("accounting", services.accounting);
  app.decorate("licensing", services.licensing);
  app.decorate("inventory", services.inventory);
  applyHttpCompilers(app);
  registerErrorHandler(app, errorReporter);
  await registerCookie(app);
  await registerMultipart(app);

  await app.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: { title: titles[audience], version: "0.0.0" },
      servers: [{ url: "http://localhost:3001" }],
    },
    transform: swaggerTransform,
  });

  await registerAudienceMounts(app, audience);
  await app.ready();
  return app;
}

export type BuildAppOptions = AppServiceOverrides & {
  logger?: FastifyServerOptions["logger"];
  drainState?: DrainState;
  errorReporter?: IErrorReporter;
};

/** Combined composition root: Pino + requestId, health, Ping, three mounts. */
export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const services = composeAppServices(options);
  const drainState = options.drainState ?? new DrainState();
  const errorReporter = options.errorReporter ?? new NoopErrorReporter();
  const app = Fastify({
    logger: options.logger ?? pinoLoggerOptions(),
    ...requestIdConfig(),
  });
  app.decorate("features", services.features);
  app.decorate("drainState", drainState);
  app.decorate("errorReporter", errorReporter);
  app.decorate("ping", services.ping);
  app.decorate("readyCheck", services.ready);
  app.decorate("identity", services.identity);
  app.decorate("customers", services.customers);
  app.decorate("catalog", services.catalog);
  app.decorate("purchasing", services.purchasing);
  app.decorate("sales", services.sales);
  app.decorate("accounting", services.accounting);
  app.decorate("licensing", services.licensing);
  app.decorate("inventory", services.inventory);
  applyHttpCompilers(app);
  registerRequestIdHook(app);
  registerErrorHandler(app, errorReporter);
  await registerCookie(app);
  await registerCors(app);
  await registerMultipart(app);
  registerHealthRoutes(app);
  registerPingRoute(app);
  await registerAudienceMounts(app);
  app.addHook("onClose", async () => {
    await services.database.close();
  });
  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    features: IFeatures;
    drainState: DrainState;
    errorReporter: IErrorReporter;
    ping: PingUseCase;
    readyCheck: ReadyCheckUseCase;
    identity: IdentityHttpServices;
    customers: CustomersHttpServices;
    catalog: CatalogHttpServices;
    purchasing: PurchasingHttpServices;
    sales: SalesHttpServices;
    accounting: AccountingHttpServices;
    licensing: LicensingHttpServices;
    inventory: InventoryHttpServices;
  }

  interface FastifyRequest {
    staffAuth?: { staffUserId: string; email: string; organizationId: string };
    wholesaleAuth?: {
      wholesaleUserId: string;
      email: string;
      customerId: string;
      organizationId: string;
    };
  }
}
