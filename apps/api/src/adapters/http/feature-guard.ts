import type { FeatureName } from "@dc-inventory/licensing";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import {
  featureDisabledResponseSchema,
  needsCustomerResponseSchema,
} from "../../schemas.js";
import { staffOrganizationId, wholesaleOrganizationId } from "./org-session.js";

type FeatureAudience = "staff" | "wholesale";

function sendFeatureDisabled(reply: FastifyReply) {
  return reply.code(403).send({ error: "feature_disabled" as const });
}

export function registerFeatureGuard(
  app: FastifyInstance,
  featureName: FeatureName,
  audience: FeatureAudience,
): void {
  app.addHook("onRoute", (routeOptions) => {
    const response =
      typeof routeOptions.schema?.response === "object" &&
      routeOptions.schema.response !== null
        ? routeOptions.schema.response
        : {};
    const existing403 =
      "403" in response ? response[403] : undefined;
    const merged403 =
      existing403 === undefined
        ? z.union([featureDisabledResponseSchema, needsCustomerResponseSchema])
        : z.union([
            existing403 as z.ZodTypeAny,
            featureDisabledResponseSchema,
            needsCustomerResponseSchema,
          ]);
    routeOptions.schema = {
      ...routeOptions.schema,
      response: {
        ...response,
        403: merged403,
      },
    };
  });
  app.addHook("preHandler", async (request, reply) => {
    if (reply.sent) {
      return;
    }
    const organizationId =
      audience === "staff"
        ? staffOrganizationId(request)
        : wholesaleOrganizationId(request);
    if (!(await request.server.features.isEnabled(organizationId, featureName))) {
      return sendFeatureDisabled(reply);
    }
  });
}
