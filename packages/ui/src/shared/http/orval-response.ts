export function readOrvalHttpStatus(result: unknown): number | undefined {
  if (result !== null && typeof result === "object" && "status" in result) {
    const status = (result as { status: unknown }).status;
    if (typeof status === "number") {
      return status;
    }
  }
  return undefined;
}

export function isSuccessfulOrvalResponse(result: unknown): boolean {
  const status = readOrvalHttpStatus(result);
  if (status === undefined) {
    return true;
  }
  return status >= 200 && status < 300;
}

export function assertSuccessfulOrvalResponse(result: unknown): void {
  const status = readOrvalHttpStatus(result);
  if (status !== undefined && (status < 200 || status >= 300)) {
    throw new Error(`HTTP ${status}`);
  }
}
