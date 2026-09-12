import {
  CustomerId,
  OrganizationId,
  WholesaleUserId,
  type CustomerId as CustomerIdType,
  type OrganizationId as OrganizationIdType,
  type WholesaleUserId as WholesaleUserIdType,
} from "@dc-inventory/shared-kernel";
import { normalizeEmail } from "../domain/email.js";
import { newUuid } from "../domain/ids.js";
import type { IEmailSender } from "../domain/ports/email-sender.js";
import type { IOrganizationRepository } from "../domain/ports/organization-repository.js";
import type { IPasswordHasher } from "../domain/ports/password-hasher.js";
import type { IWholesaleUserRepository } from "../domain/ports/wholesale-user-repository.js";
import { parseDisplayName } from "../domain/required-text.js";
import type { WholesaleUser } from "../domain/wholesale-user.js";
import { buildWholesaleInviteEmail } from "./wholesale-invite-email.js";

export type CreateWholesaleUserRequest = {
  organizationId: OrganizationIdType;
  customerId: CustomerIdType;
  email: string;
  displayName: string;
};

export type CreateWholesaleUserInviteLinks = {
  buildSetPasswordUrl(input: {
    organizationSlug: string;
    wholesaleUserId: WholesaleUserIdType;
    wholesaleEmail: string;
  }): Promise<string>;
};

export type CreateWholesaleUserResult =
  | {
      ok: true;
      wholesaleUserId: WholesaleUserIdType;
      inviteSentTo: string;
    }
  | { ok: false; reason: "invalid" | "duplicate_email" | "invite_failed" };

export class CreateWholesaleUserUseCase {
  constructor(
    private readonly organizations: IOrganizationRepository,
    private readonly wholesaleUsers: IWholesaleUserRepository,
    private readonly passwords: IPasswordHasher,
    private readonly email: IEmailSender,
    private readonly inviteLinks: CreateWholesaleUserInviteLinks,
  ) {}

  async execute(input: CreateWholesaleUserRequest): Promise<CreateWholesaleUserResult> {
    const organization = await this.organizations.findById(input.organizationId);
    if (organization === null) {
      return { ok: false, reason: "invalid" };
    }

    const email = normalizeEmail(input.email);
    if (email.length === 0) {
      return { ok: false, reason: "invalid" };
    }

    let displayName: string;
    try {
      displayName = parseDisplayName(input.displayName);
    } catch {
      return { ok: false, reason: "invalid" };
    }

    const customerId = CustomerId.parse(input.customerId);
    const organizationId = OrganizationId.parse(input.organizationId);

    const existing = await this.wholesaleUsers.findByEmail(organizationId, email);
    if (existing !== null) {
      return { ok: false, reason: "duplicate_email" };
    }

    const pendingPassword = `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const wholesaleUserId = WholesaleUserId.parse(newUuid());

    const wholesaleUser: WholesaleUser = {
      id: wholesaleUserId,
      organizationId,
      displayName,
      email,
      passwordHash: await this.passwords.hash(pendingPassword),
      customerId,
    };

    await this.wholesaleUsers.save(wholesaleUser);

    try {
      await this.email.send(
        buildWholesaleInviteEmail({
          organizationName: organization.name,
          organizationSlug: organization.slug,
          displayName,
          wholesaleEmail: email,
          wholesaleUserId,
          setPasswordUrl: await this.inviteLinks.buildSetPasswordUrl({
            organizationSlug: organization.slug,
            wholesaleUserId,
            wholesaleEmail: email,
          }),
        }),
      );
    } catch {
      return { ok: false, reason: "invite_failed" };
    }

    return {
      ok: true,
      wholesaleUserId,
      inviteSentTo: email,
    };
  }
}
