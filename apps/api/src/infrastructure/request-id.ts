import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { LogController, type FastifyInstance, type FastifyServerOptions } from "fastify";

export const REQUEST_ID_HEADER = "x-request-id";

export function genReqId(req: IncomingMessage): string {
  const header = req.headers[REQUEST_ID_HEADER];
  if (typeof header === "string" && header.length > 0) {
    return header;
  }
  if (Array.isArray(header) && typeof header[0] === "string" && header[0].length > 0) {
    return header[0];
  }
  return randomUUID();
}

export function requestIdConfig(): Pick<
  FastifyServerOptions,
  "genReqId" | "logController" | "requestIdHeader"
> {
  return {
    requestIdHeader: REQUEST_ID_HEADER,
    genReqId,
    logController: new LogController({ requestIdLogLabel: "requestId" }),
  };
}

/** Echo the request id on every response (uptime and agent incident packets). */
export function registerRequestIdHook(app: FastifyInstance): void {
  app.addHook("onSend", async (request, reply) => {
    void reply.header(REQUEST_ID_HEADER, request.id);
  });
}
