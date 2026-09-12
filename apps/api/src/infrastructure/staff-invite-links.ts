import {
  SET_PASSWORD_TOKEN_TTL_MS,
  type CreateStaffUserInviteLinks,
  type IClock,
  type ISetPasswordTokenStore,
  type RegisterOrganizationInviteLinks,
} from "@dc-inventory/identity";

function internalAppBaseUrl(): string {
  const configured = process.env.INTERNAL_APP_URL?.trim();
  if (configured !== undefined && configured.length > 0) {
    return configured.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

export function buildInternalSetPasswordUrl(
  baseUrl: string,
  rawToken: string,
  organizationSlug: string,
  staffEmail: string,
  staffDisplayName: string,
): string {
  const params = new URLSearchParams({ token: rawToken });
  const organization = organizationSlug.trim();
  const email = staffEmail.trim();
  const name = staffDisplayName.trim();
  if (organization.length > 0) {
    params.set("organization", organization);
  }
  if (email.length > 0) {
    params.set("email", email);
  }
  if (name.length > 0) {
    params.set("name", name);
  }
  return `${baseUrl}/set-password?${params.toString()}`;
}

export function createStaffInviteLinks(
  tokenStore: ISetPasswordTokenStore,
  clock: IClock,
): RegisterOrganizationInviteLinks & CreateStaffUserInviteLinks {
  const baseUrl = internalAppBaseUrl();
  return {
    async buildSetPasswordUrl({ organizationSlug, staffUserId, staffEmail, staffDisplayName }) {
      const { rawToken } = await tokenStore.mint({
        audience: "staff",
        userId: staffUserId,
        expiresAt: new Date(clock.now().getTime() + SET_PASSWORD_TOKEN_TTL_MS),
      });
      return buildInternalSetPasswordUrl(
        baseUrl,
        rawToken,
        organizationSlug,
        staffEmail,
        staffDisplayName,
      );
    },
  };
}
