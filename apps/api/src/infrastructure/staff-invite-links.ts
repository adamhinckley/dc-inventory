import type {
  CreateStaffUserInviteLinks,
  RegisterOrganizationInviteLinks,
} from "@dc-inventory/identity";

function internalAppBaseUrl(): string {
  const configured = process.env.INTERNAL_APP_URL?.trim();
  if (configured !== undefined && configured.length > 0) {
    return configured.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

export function createStaffInviteLinks(): RegisterOrganizationInviteLinks &
  CreateStaffUserInviteLinks {
  const baseUrl = internalAppBaseUrl();
  return {
    buildSetPasswordUrl({ organizationSlug, staffUserId, staffEmail }) {
      const params = new URLSearchParams({
        org: organizationSlug,
        user: staffUserId,
        email: staffEmail,
      });
      return `${baseUrl}/set-password?${params.toString()}`;
    },
  };
}
