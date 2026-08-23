import type { CustomerId } from "@dc-inventory/shared-kernel";
import type { ExemptionCertificateId } from "./ids.js";

export type ExemptionCertificate = {
  id: ExemptionCertificateId;
  customerId: CustomerId;
  objectKey: string | null;
  jurisdiction: string;
  entityUseCode: string | null;
  expiresAt: Date | null;
  status: string;
};
