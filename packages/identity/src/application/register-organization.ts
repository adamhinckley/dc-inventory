import {
  OrganizationId,
  StaffUserId,
  type OrganizationId as OrganizationIdType,
} from "@dc-inventory/shared-kernel";
import { normalizeEmail } from "../domain/email.js";
import { newUuid } from "../domain/ids.js";
import type { Organization } from "../domain/organization.js";
import type { IPasswordHasher } from "../domain/ports/password-hasher.js";
import type { IIdentityUnitOfWork } from "../domain/ports/identity-unit-of-work.js";
import type { StaffUser } from "../domain/staff-user.js";

export type RegisterOrganizationRequest = {
  slug: string;
  staffEmail: string;
  staffPassword: string;
};

export type RegisterOrganizationResult =
  | {
      ok: true;
      organizationId: OrganizationIdType;
      staffUserId: StaffUserId;
      slug: string;
    }
  | { ok: false; reason: "invalid" | "slug_taken" };

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

export class RegisterOrganizationUseCase {
  constructor(
    private readonly uow: IIdentityUnitOfWork,
    private readonly passwords: IPasswordHasher,
  ) {}

  async execute(input: RegisterOrganizationRequest): Promise<RegisterOrganizationResult> {
    const slug = normalizeSlug(input.slug);
    const email = normalizeEmail(input.staffEmail);
    const password = input.staffPassword;

    if (!SLUG_PATTERN.test(slug) || email.length === 0 || password.length === 0) {
      return { ok: false, reason: "invalid" };
    }

    return this.uow.run(async (tx) => {
      const existingSlug = await tx.organizations.findBySlug(slug);
      if (existingSlug !== null) {
        return { ok: false, reason: "slug_taken" } as const;
      }

      const organizationId = OrganizationId.parse(newUuid());

      const organization: Organization = { id: organizationId, slug };
      const staffUser: StaffUser = {
        id: StaffUserId.parse(newUuid()),
        organizationId,
        email,
        passwordHash: await this.passwords.hash(password),
      };

      await tx.organizations.save(organization);
      await tx.staffUsers.save(staffUser);

      return {
        ok: true,
        organizationId,
        staffUserId: staffUser.id,
        slug,
      } as const;
    });
  }
}
