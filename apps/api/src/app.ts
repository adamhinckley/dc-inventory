import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import Fastify, {
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
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
import { featuresAllCoreOn, type IFeatures } from "./features.js";
import {
  composeAppServices,
  type AppServiceOverrides,
  type CatalogHttpServices,
  type CustomersHttpServices,
  type IdentityHttpServices,
  type PurchasingHttpServices,
} from "./infrastructure/composition.js";
import { pinoLoggerOptions } from "./infrastructure/logging.js";
import {
  registerRequestIdHook,
  requestIdConfig,
} from "./infrastructure/request-id.js";
import { internalRoutes } from "./internal/routes.js";
import { opsRoutes } from "./ops/routes.js";
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
  app.decorate("features", features);
  app.decorate("identity", services.identity);
  app.decorate("customers", services.customers);
  app.decorate("catalog", services.catalog);
  app.decorate("purchasing", services.purchasing);
  applyHttpCompilers(app);
  await registerCookie(app);

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
};

/** Combined composition root: Pino + requestId, health, Ping, three mounts. */
export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const services = composeAppServices(options);
  const app = Fastify({
    logger: options.logger ?? pinoLoggerOptions(),
    ...requestIdConfig(),
  });
  app.decorate("features", services.features);
  app.decorate("ping", services.ping);
  app.decorate("readyCheck", services.ready);
  app.decorate("identity", services.identity);
  app.decorate("customers", services.customers);
  app.decorate("catalog", services.catalog);
  app.decorate("purchasing", services.purchasing);
  applyHttpCompilers(app);
  registerRequestIdHook(app);
  await registerCookie(app);
  await registerCors(app);
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
    ping: PingUseCase;
    readyCheck: ReadyCheckUseCase;
    identity: IdentityHttpServices;
    customers: CustomersHttpServices;
    catalog: CatalogHttpServices;
    purchasing: PurchasingHttpServices;
  }

  interface FastifyRequest {
    staffAuth?: { staffUserId: string; email: string };
    wholesaleAuth?: {
      wholesaleUserId: string;
      email: string;
      customerId: string;
    };
  }
}
