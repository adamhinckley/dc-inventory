"use client";

import { useRouter } from "next/navigation";
import { StaffSignInForm } from "../../../components/staff-sign-in-form";

export default function LoginPage() {
  const router = useRouter();

  return (
    <section className="section-flat w-full max-w-md p-panel">
      <h1 className="page-title">Sign in</h1>
      <p className="page-description mt-2">
        Staff sign-in uses organization <code>acme</code> with <code>staff@local.test</code> after{" "}
        <code>pnpm db:seed:phase1</code>. Platform sign-in uses <code>adam@local.test</code> with
        no organization slug.
      </p>
      <StaffSignInForm
        onSignedIn={(session) => {
          router.push(session.audience === "platform" ? "/organizations/new" : "/catalog");
        }}
      />
    </section>
  );
}
