import Fastify, { type FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { featuresAllCoreOn, type IFeatures } from "./features.js";
import {
  registerInternalRoutes,
  registerOpsRoutes,
  registerWholesaleRoutes,
} from "./routes.js";
import { swaggerTransform } from "./swagger-transform.js";

export type Audience = "internal" | "wholesale" | "ops";

const titles: Record<Audience, string> = {
  internal: "DC Inventory internal API",
  wholesale: "DC Inventory wholesale API",
  ops: "DC Inventory ops API",
};

export async function buildAudienceApp(
  audience: Audience,
  features: IFeatures = featuresAllCoreOn(),
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.decorate("features", features);
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: { title: titles[audience], version: "0.0.0" },
      servers: [{ url: "http://localhost:3001" }],
    },
    transform: swaggerTransform,
  });

  if (audience === "internal") registerInternalRoutes(app);
  if (audience === "wholesale") registerWholesaleRoutes(app);
  if (audience === "ops") registerOpsRoutes(app);

  await app.ready();
  return app;
}

/** Combined composition root: three route trees + in-memory IFeatures (core on). */
export async function buildApp(
  features: IFeatures = featuresAllCoreOn(),
): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  app.decorate("features", features);
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  registerInternalRoutes(app);
  registerWholesaleRoutes(app);
  registerOpsRoutes(app);

  app.get("/health", async () => ({ ok: true }));

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    features: IFeatures;
  }
}
