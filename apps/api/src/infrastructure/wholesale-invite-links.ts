import {
  SET_PASSWORD_TOKEN_TTL_MS,
  type CreateWholesaleUserInviteLinks,
  type IClock,
  type ISetPasswordTokenStore,
} from "@dc-inventory/identity";

function wholesaleAppBaseUrl(): string {
  const configured = process.env.WHOLESALE_APP_URL?.trim();
  if (configured !== undefined && configured.length > 0) {
    return configured.replace(/\/$/, "");
  }
  return "http://localhost:3002";
}

export function buildWholesaleSetPasswordUrl(
  baseUrl: string,
  rawToken: string,
  organizationSlug: string,
  wholesaleEmail: string,
  displayName: string,
): string {
  const params = new URLSearchParams({ token: rawToken });
  const organization = organizationSlug.trim();
  const email = wholesaleEmail.trim();
  const name = displayName.trim();
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

export function createWholesaleInviteLinks(
  tokenStore: ISetPasswordTokenStore,
  clock: IClock,
): CreateWholesaleUserInviteLinks {
  const baseUrl = wholesaleAppBaseUrl();
  return {
    async buildSetPasswordUrl({ organizationSlug, wholesaleUserId, wholesaleEmail, displayName }) {
      const { rawToken } = await tokenStore.mint({
        audience: "wholesale",
        userId: wholesaleUserId,
        expiresAt: new Date(clock.now().getTime() + SET_PASSWORD_TOKEN_TTL_MS),
      });
      return buildWholesaleSetPasswordUrl(
        baseUrl,
        rawToken,
        organizationSlug,
        wholesaleEmail,
        displayName,
      );
    },
  };
}
