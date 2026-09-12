import {
  OrganizationId,
  StaffUserId,
  type OrganizationId as OrganizationIdType,
} from "@dc-inventory/shared-kernel";
import { normalizeEmail } from "../domain/email.js";
import { newUuid } from "../domain/ids.js";
import {
  isOrganizationSlugValid,
  normalizeOrganizationSlug,
} from "../domain/organization-slug.js";
import type { Organization } from "../domain/organization.js";
import type { IEmailSender } from "../domain/ports/email-sender.js";
import type { IPasswordHasher } from "../domain/ports/password-hasher.js";
import type { IIdentityUnitOfWork } from "../domain/ports/identity-unit-of-work.js";
import { parseDisplayName, parseOrganizationName } from "../domain/required-text.js";
import type { StaffUser } from "../domain/staff-user.js";
import { buildStaffInviteEmail } from "./staff-invite-email.js";

export type RegisterOrganizationRequest = {
  slug: string;
  name: string;
  staffEmail: string;
  staffDisplayName: string;
};

export type RegisterOrganizationInviteLinks = {
  buildSetPasswordUrl(input: {
    organizationSlug: string;
    staffUserId: StaffUserId;
    staffEmail: string;
  }): string;
};

export type RegisterOrganizationResult =
  | {
      ok: true;
      organizationId: OrganizationIdType;
      staffUserId: StaffUserId;
      slug: string;
      inviteSentTo: string;
    }
  | { ok: false; reason: "invalid" | "slug_taken" | "invite_failed" };

export class RegisterOrganizationUseCase {
  constructor(
    private readonly uow: IIdentityUnitOfWork,
    private readonly passwords: IPasswordHasher,
    private readonly email: IEmailSender,
    private readonly inviteLinks: RegisterOrganizationInviteLinks,
  ) {}

  async execute(input: RegisterOrganizationRequest): Promise<RegisterOrganizationResult> {
    const slug = normalizeOrganizationSlug(input.slug);
    const email = normalizeEmail(input.staffEmail);

    let organizationName: string;
    let staffDisplayName: string;
    try {
      organizationName = parseOrganizationName(input.name);
      staffDisplayName = parseDisplayName(input.staffDisplayName);
    } catch {
      return { ok: false, reason: "invalid" };
    }

    if (!isOrganizationSlugValid(slug) || email.length === 0) {
      return { ok: false, reason: "invalid" };
    }

    const pendingPassword = `${crypto.randomUUID()}${crypto.randomUUID()}`;

    const saved = await this.uow.run(async (tx) => {
      const existingSlug = await tx.organizations.findBySlug(slug);
      if (existingSlug !== null) {
        return { ok: false as const, reason: "slug_taken" as const };
      }

      const organizationId = OrganizationId.parse(newUuid());
      const staffUserId = StaffUserId.parse(newUuid());

      const organization: Organization = { id: organizationId, slug, name: organizationName };
      const staffUser: StaffUser = {
        id: staffUserId,
        organizationId,
        displayName: staffDisplayName,
        email,
        passwordHash: await this.passwords.hash(pendingPassword),
        roles: ["admin"],
      };

      await tx.organizations.save(organization);
      await tx.staffUsers.save(staffUser);

      return {
        ok: true as const,
        organizationId,
        staffUserId,
        slug,
        organizationName,
        staffDisplayName,
        email,
      };
    });

    if (!saved.ok) {
      return saved;
    }

    try {
      await this.email.send(
        buildStaffInviteEmail({
          organizationName: saved.organizationName,
          organizationSlug: saved.slug,
          staffDisplayName: saved.staffDisplayName,
          staffEmail: saved.email,
          staffUserId: saved.staffUserId,
          setPasswordUrl: this.inviteLinks.buildSetPasswordUrl({
            organizationSlug: saved.slug,
            staffUserId: saved.staffUserId,
            staffEmail: saved.email,
          }),
        }),
      );
    } catch {
      return { ok: false, reason: "invite_failed" };
    }

    return {
      ok: true,
      organizationId: saved.organizationId,
      staffUserId: saved.staffUserId,
      slug: saved.slug,
      inviteSentTo: saved.email,
    };
  }
}
