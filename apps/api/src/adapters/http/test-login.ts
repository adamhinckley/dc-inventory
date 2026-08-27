export const ACME_ORGANIZATION_SLUG = "acme";

export function loginBody(email: string, password: string) {
  return {
    organizationSlug: ACME_ORGANIZATION_SLUG,
    email,
    password,
  };
}
