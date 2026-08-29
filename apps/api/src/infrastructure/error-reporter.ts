export type ErrorReportContext = {
  requestId: string;
  method: string;
  route: string;
};

/**
 * Observability adapter used at the HTTP edge. Production error-reporting SDKs
 * implement this interface; tests and local development use the no-op adapter.
 */
export interface IErrorReporter {
  captureException(error: unknown, context: ErrorReportContext): void;
}

export class NoopErrorReporter implements IErrorReporter {
  captureException(_error: unknown, _context: ErrorReportContext): void {}
}
