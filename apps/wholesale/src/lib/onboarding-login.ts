export const ONBOARDING_ORGANIZATION_PARAM = "organization";
export const ONBOARDING_EMAIL_PARAM = "email";

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
