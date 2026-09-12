import { isSuccessfulOrvalResponse } from "@dc-inventory/ui";

type WriteResult = {
  status: number;
  data?: unknown;
};

function errorCode(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null || !("error" in data)) {
    return undefined;
  }
  const { error } = data as { error?: unknown };
  return typeof error === "string" ? error : undefined;
}

export function staffWriteErrorMessage(result: WriteResult): string {
  const code = errorCode(result.data);
  if (result.status === 409 && code === "duplicate_email") {
    return "Another staff member already uses this email.";
  }
  if (result.status === 400) {
    return "This staff member could not be created because the request was invalid.";
  }
  if (result.status === 403) {
    return "You do not have permission to manage staff.";
  }
  return "Could not create this staff member.";
}

export function throwIfStaffWriteFailed(result: WriteResult): void {
  if (isSuccessfulOrvalResponse(result)) {
    return;
  }
  throw new Error(staffWriteErrorMessage(result));
}
