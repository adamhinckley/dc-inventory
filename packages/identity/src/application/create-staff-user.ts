import {
  OrganizationId,
  StaffUserId,
  type OrganizationId as OrganizationIdType,
  type StaffUserId as StaffUserIdType,
} from "@dc-inventory/shared-kernel";
import { normalizeEmail } from "../domain/email.js";
import { newUuid } from "../domain/ids.js";
import type { IEmailSender } from "../domain/ports/email-sender.js";
import type { IOrganizationRepository } from "../domain/ports/organization-repository.js";
import type { IPasswordHasher } from "../domain/ports/password-hasher.js";
import type { IStaffUserRepository } from "../domain/ports/staff-user-repository.js";
import { parseDisplayName } from "../domain/required-text.js";
import { STAFF_ROLES, type StaffRole } from "../domain/staff-role.js";
import type { StaffUser } from "../domain/staff-user.js";
import { buildStaffInviteEmail } from "./staff-invite-email.js";

export type CreateStaffUserRequest = {
  organizationId: OrganizationIdType;
  displayName: string;
  email: string;
  roles: readonly string[];
};

export type CreateStaffUserInviteLinks = {
  buildSetPasswordUrl(input: {
    organizationSlug: string;
    staffUserId: StaffUserIdType;
    staffEmail: string;
    staffDisplayName: string;
  }): Promise<string>;
};

export type CreateStaffUserResult =
  | { ok: true; staffUser: StaffUser }
  | { ok: false; reason: "invalid" | "email_taken" | "invite_failed" };

const STAFF_ROLE_SET = new Set<string>(STAFF_ROLES);

function parseStaffRoles(roles: readonly string[]): StaffRole[] | null {
  if (roles.length === 0) {
    return null;
  }
  const parsed: StaffRole[] = [];
  const seen = new Set<StaffRole>();
  for (const role of roles) {
    if (!STAFF_ROLE_SET.has(role)) {
      return null;
    }
    const staffRole = role as StaffRole;
    if (!seen.has(staffRole)) {
      seen.add(staffRole);
      parsed.push(staffRole);
    }
  }
  return parsed.length === 0 ? null : parsed;
}

export class CreateStaffUserUseCase {
  constructor(
    private readonly organizations: IOrganizationRepository,
    private readonly staffUsers: IStaffUserRepository,
    private readonly passwords: IPasswordHasher,
    private readonly email: IEmailSender,
    private readonly inviteLinks: CreateStaffUserInviteLinks,
  ) {}

  async execute(input: CreateStaffUserRequest): Promise<CreateStaffUserResult> {
    const organization = await this.organizations.findById(input.organizationId);
    if (organization === null) {
      return { ok: false, reason: "invalid" };
    }

    const email = normalizeEmail(input.email);
    const roles = parseStaffRoles(input.roles);

    let displayName: string;
    try {
      displayName = parseDisplayName(input.displayName);
    } catch {
      return { ok: false, reason: "invalid" };
    }

    if (email.length === 0 || roles === null) {
      return { ok: false, reason: "invalid" };
    }

    const existing = await this.staffUsers.findByEmail(input.organizationId, email);
    if (existing !== null) {
      return { ok: false, reason: "email_taken" };
    }

    const pendingPassword = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const staffUserId = StaffUserId.parse(newUuid());

    const staffUser: StaffUser = {
      id: staffUserId,
      organizationId: OrganizationId.parse(input.organizationId),
      displayName,
      email,
      passwordHash: await this.passwords.hash(pendingPassword),
      roles,
    };

    await this.staffUsers.save(staffUser);

    try {
      await this.email.send(
        buildStaffInviteEmail({
          organizationName: organization.name,
          organizationSlug: organization.slug,
          staffDisplayName: displayName,
          staffEmail: email,
          staffUserId,
          inviteKind: "staff",
          setPasswordUrl: await this.inviteLinks.buildSetPasswordUrl({
            organizationSlug: organization.slug,
            staffUserId,
            staffEmail: email,
            staffDisplayName: displayName,
          }),
        }),
      );
    } catch {
      return { ok: false, reason: "invite_failed" };
    }

    return { ok: true, staffUser };
  }
}
