"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { StaffSignInForm } from "../../../components/staff-sign-in-form";
import {
  defaultStaffOrganizationSlug,
  onboardingPrefillFromSearchParams,
} from "../../../lib/onboarding-login";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefill = onboardingPrefillFromSearchParams(searchParams);

  return (
    <StaffSignInForm
      defaultOrganizationSlug={defaultStaffOrganizationSlug(prefill.organization)}
      defaultEmail={prefill.email}
      onSignedIn={(session) => {
        router.push(session.audience === "platform" ? "/organizations" : "/catalog");
      }}
    />
  );
}

export default function LoginPage() {
  return (
    <section className="section-flat w-full max-w-md p-panel">
      <h1 className="page-title">Sign in</h1>
      <p className="page-description mt-2">
        Staff sign-in uses organization <code>acme</code> with <code>staff@local.test</code> after{" "}
        <code>pnpm db:seed:phase1</code>. For Platform (<code>adam@local.test</code>), clear
        Organization.
      </p>
      <Suspense fallback={<p className="text-fg-muted">Loading…</p>}>
        <LoginForm />
      </Suspense>
    </section>
  );
}
