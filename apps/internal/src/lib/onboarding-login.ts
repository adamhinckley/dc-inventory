export const ONBOARDING_ORGANIZATION_PARAM = "organization";
export const ONBOARDING_EMAIL_PARAM = "email";
export const ONBOARDING_NAME_PARAM = "name";

export type OnboardingLoginPrefill = {
  organization: string;
  email: string;
};

export function onboardingPrefillFromSearchParams(params: {
  get(name: string): string | null;
}): OnboardingLoginPrefill {
  return {
    organization: params.get(ONBOARDING_ORGANIZATION_PARAM)?.trim() ?? "",
    email: params.get(ONBOARDING_EMAIL_PARAM)?.trim() ?? "",
  };
}

export function loginPathWithOnboarding(prefill: OnboardingLoginPrefill): string {
  const params = new URLSearchParams();
  if (prefill.organization.length > 0) {
    params.set(ONBOARDING_ORGANIZATION_PARAM, prefill.organization);
  }
  if (prefill.email.length > 0) {
    params.set(ONBOARDING_EMAIL_PARAM, prefill.email);
  }
  const query = params.toString();
  return query.length > 0 ? `/login?${query}` : "/login";
}

export function defaultStaffOrganizationSlug(fromUrl: string): string {
  return fromUrl.length > 0 ? fromUrl : "acme";
}

export function inviteDisplayNameFromSearchParams(params: {
  get(name: string): string | null;
}): string {
  return params.get(ONBOARDING_NAME_PARAM)?.trim() ?? "";
}

export function firstNameFromDisplayName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] ?? "";
}

export function setPasswordHeading(displayName: string): string {
  const firstName = firstNameFromDisplayName(displayName);
  return firstName.length > 0 ? `Hello ${firstName}.` : "Let's set up your password.";
}

export const SET_PASSWORD_LEAD = "Let's set up your password.";
