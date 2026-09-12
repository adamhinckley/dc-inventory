import type {
  CustomerId,
  OrganizationId,
  PlatformUserId,
  SessionId,
  StaffUserId,
  WholesaleUserId,
} from "@dc-inventory/shared-kernel";
import type { OpsActorKind, OpsUserId } from "../ops-user.js";
import type { StaffRole } from "../staff-role.js";
import type { Session, SessionAudience } from "../session.js";

export type NewSession = {
  audience: SessionAudience;
  organizationId: OrganizationId | null;
  staffUserId: StaffUserId | null;
  platformUserId: PlatformUserId | null;
  wholesaleUserId: WholesaleUserId | null;
  opsUserId: OpsUserId | null;
  customerId: CustomerId | null;
  createdAt: Date;
  lastSeenAt: Date;
};

export type StaffResolvedSession = {
  session: Session;
  email: string;
  displayName: string;
  roles: readonly StaffRole[];
};

export type WholesaleResolvedSession =
  | { mode: "staff_acting"; session: Session; email: string }
  | { mode: "buyer"; session: Session; email: string };

export type OpsResolvedSession = {
  session: Session;
  email: string;
  kind: OpsActorKind;
  tenantId: OrganizationId;
};

export type PlatformResolvedSession = {
  session: Session;
  email: string;
  displayName: string;
};

export interface ISessionStore {
  create(input: NewSession): Promise<Session>;
  findById(id: SessionId): Promise<Session | null>;
  touch(id: SessionId, lastSeenAt: Date): Promise<void>;
  updateCustomerId(id: SessionId, customerId: CustomerId | null): Promise<void>;
  delete(id: SessionId): Promise<void>;
  findStaffResolved?(id: SessionId): Promise<StaffResolvedSession | null>;
  findWholesaleResolved?(id: SessionId): Promise<WholesaleResolvedSession | null>;
  findOpsResolved?(id: SessionId): Promise<OpsResolvedSession | null>;
  findPlatformResolved?(id: SessionId): Promise<PlatformResolvedSession | null>;
}
