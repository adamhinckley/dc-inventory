"use client";

import { useRouter } from "next/navigation";
import { StaffSignInForm } from "../../../components/staff-sign-in-form";

export default function LoginPage() {
  const router = useRouter();

  return (
    <section className="section-flat w-full max-w-md p-panel">
      <h1 className="page-title">Sign in</h1>
      <p className="page-description mt-2">
        Staff sign-in. After <code>pnpm db:seed:phase1</code>, use organization{" "}
        <code>acme</code> with <code>staff@local.test</code>.
      </p>
      <div className="mt-8">
        <StaffSignInForm onSignedIn={() => router.push("/catalog")} />
      </div>
    </section>
  );
}
