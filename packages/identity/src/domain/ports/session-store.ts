import type {
  CustomerId,
  OrganizationId,
  SessionId,
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import type { OpsUserId } from "../ops-user.js";
import type { Session, SessionAudience } from "../session.js";

export type NewSession = {
  audience: SessionAudience;
  organizationId: OrganizationId;
  staffUserId: StaffUserId | null;
  wholesaleUserId: WholesaleUserId | null;
  opsUserId: OpsUserId | null;
  customerId: CustomerId | null;
  createdAt: Date;
  lastSeenAt: Date;
};

export interface ISessionStore {
  create(input: NewSession): Promise<Session>;
  findById(id: SessionId): Promise<Session | null>;
  touch(id: SessionId, lastSeenAt: Date): Promise<void>;
  delete(id: SessionId): Promise<void>;
}
