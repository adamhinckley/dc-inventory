import type { FastifyError, FastifyInstance, FastifyRequest } from "fastify";
import type { IErrorReporter } from "./error-reporter.js";

type SafeError = {
  statusCode: number;
  code: string;
  message: string;
};

const knownErrors: Record<number, Omit<SafeError, "statusCode">> = {
  400: { code: "invalid_request", message: "The request is invalid." },
  401: { code: "unauthorized", message: "Authentication is required." },
  403: { code: "forbidden", message: "The request is not allowed." },
  404: { code: "not_found", message: "The requested resource was not found." },
  409: { code: "conflict", message: "The request conflicts with current state." },
  413: { code: "payload_too_large", message: "The request payload is too large." },
  429: { code: "rate_limited", message: "Too many requests." },
};

function routeFor(request: FastifyRequest): string {
  return request.routeOptions.url ?? request.url;
}

function knownError(error: FastifyError): SafeError | undefined {
  const statusCode = error.validation ? 400 : error.statusCode;
  if (statusCode === undefined || statusCode < 400 || statusCode >= 500) {
    return undefined;
  }
  const mapped = knownErrors[statusCode] ?? knownErrors[400];
  return { statusCode, ...mapped };
}

export function registerErrorHandler(
  app: FastifyInstance,
  errorReporter: IErrorReporter,
): void {
  app.setErrorHandler((error, request, reply) => {
    const mapped = knownError(error);
    if (mapped) {
      request.log.warn(
        {
          err: error,
          requestId: request.id,
          statusCode: mapped.statusCode,
        },
        "request rejected",
      );
      return reply.code(mapped.statusCode).send({
        error: mapped.code,
        message: mapped.message,
        requestId: request.id,
      });
    }

    const context = {
      requestId: request.id,
      method: request.method,
      route: routeFor(request),
    };
    request.log.error({ err: error, ...context }, "request failed");
    errorReporter.captureException(error, context);
    return reply.code(500).send({
      error: "internal_error",
      message: "An unexpected error occurred.",
      requestId: request.id,
    });
  });
}
