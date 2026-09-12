"use client";

import { useSetPasswordWholesale } from "@dc-inventory/api-client-wholesale";
import Link from "next/link";
import {
  loginPathWithOnboarding,
  onboardingPrefillFromSearchParams,
} from "../../../lib/onboarding-login";
import {
  PASSWORD_POLICY_UI_COPY,
  readMatchingNewPassword,
} from "../../../lib/password-policy-ui-copy";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { ShopPage } from "../../../components/shop-page";

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const loginHref = loginPathWithOnboarding(onboardingPrefillFromSearchParams(searchParams));
  const setPassword = useSetPasswordWholesale();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const passwordType = showPassword ? "text" : "password";

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (token.length === 0) {
      setError("This invite link is invalid or expired.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const matched = readMatchingNewPassword(
      String(form.get("password") ?? ""),
      String(form.get("confirmPassword") ?? ""),
    );
    if (!matched.ok) {
      setError(matched.error);
      return;
    }
    const password = matched.password;
    setError(null);
    setPassword.mutate(
      { data: { token, password } },
      {
        onSuccess: (response) => {
          if (response.status === 200) {
            router.push(loginHref);
            return;
          }
          if (response.status === 400 && "violation" in response.data) {
            setError(PASSWORD_POLICY_UI_COPY);
            return;
          }
          setError("This invite link is invalid or expired.");
        },
        onError: () => {
          setError("This invite link is invalid or expired.");
        },
      },
    );
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-line bg-card p-8 shadow-sm">
      <p className="section-title">Account</p>
      <h1 className="page-title mt-2">Set your password</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Choose a password to finish setting up your wholesale account.
      </p>
      <form className="mt-8 flex flex-col gap-4" onSubmit={onSubmit}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Password</span>
          <input
            type={passwordType}
            name="password"
            autoComplete="new-password"
            required
            className="shop-input"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Confirm Password</span>
          <input
            type={passwordType}
            name="confirmPassword"
            autoComplete="new-password"
            required
            className="shop-input"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <input
            type="checkbox"
            checked={showPassword}
            onChange={(event) => setShowPassword(event.target.checked)}
          />
          Show Password
        </label>
        <p className="text-sm text-ink-muted">{PASSWORD_POLICY_UI_COPY}</p>
        {error !== null ? (
          <p className="text-sold-out" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={setPassword.isPending || token.length === 0}
          className="shop-button-primary"
        >
          {setPassword.isPending ? "Saving…" : "Save Password"}
        </button>
      </form>
      <p className="mt-6 text-sm text-ink-muted">
        Already have a password?{" "}
        <Link href={loginHref} className="font-medium text-accent hover:text-accent-hover">
          Sign in
        </Link>
      </p>
    </section>
  );
}

export default function SetPasswordPage() {
  return (
    <ShopPage>
      <Suspense fallback={<p className="text-ink-muted">Loading…</p>}>
        <SetPasswordForm />
      </Suspense>
    </ShopPage>
  );
}
