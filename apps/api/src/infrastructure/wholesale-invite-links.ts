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

export function createWholesaleInviteLinks(
  tokenStore: ISetPasswordTokenStore,
  clock: IClock,
): CreateWholesaleUserInviteLinks {
  const baseUrl = wholesaleAppBaseUrl();
  return {
    async buildSetPasswordUrl({ wholesaleUserId }) {
      const { rawToken } = await tokenStore.mint({
        audience: "wholesale",
        userId: wholesaleUserId,
        expiresAt: new Date(clock.now().getTime() + SET_PASSWORD_TOKEN_TTL_MS),
      });
      const params = new URLSearchParams({ token: rawToken });
      return `${baseUrl}/set-password?${params.toString()}`;
    },
  };
}
