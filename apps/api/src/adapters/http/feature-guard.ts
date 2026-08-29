import type { FeatureName } from "@dc-inventory/licensing";
import type { FastifyInstance, FastifyReply } from "fastify";
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
