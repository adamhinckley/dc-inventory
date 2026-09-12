"use client";

import { useSetPasswordInternal } from "@dc-inventory/api-client-internal";
import {
  Button,
  Checkbox,
  Input,
  Label,
  LabeledField,
  isSuccessfulOrvalResponse,
} from "@dc-inventory/ui";
import {
  loginPathWithOnboarding,
  onboardingPrefillFromSearchParams,
} from "../../../lib/onboarding-login";
import {
  PASSWORD_POLICY_UI_COPY,
  readMatchingNewPassword,
} from "../../../lib/password-policy-ui-copy";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const audience = searchParams.get("audience") === "platform" ? "platform" : "staff";
  const prefill = onboardingPrefillFromSearchParams(searchParams);
  const loginHref = loginPathWithOnboarding(prefill);
  const setPassword = useSetPasswordInternal();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const passwordType = showPassword ? "text" : "password";

  const accountKind = audience === "platform" ? "platform" : "staff";

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
      { data: { token, password, audience } },
      {
        onSuccess: (result) => {
          if (!isSuccessfulOrvalResponse(result)) {
            if (result.status === 400 && "violation" in result.data) {
              setError(PASSWORD_POLICY_UI_COPY);
              return;
            }
            setError("This invite link is invalid or expired.");
            return;
          }
          router.push(loginHref);
        },
        onError: () => {
          setError("This invite link is invalid or expired.");
        },
      },
    );
  }

  return (
    <section className="section-flat w-full max-w-md p-panel">
      <h1 className="page-title">Set your password</h1>
      <p className="page-description mt-2">
        Choose a password to finish setting up your {accountKind} account.
      </p>
      <form className="mt-8 flex flex-col gap-field-group" onSubmit={onSubmit}>
        <LabeledField>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type={passwordType}
            name="password"
            autoComplete="new-password"
            required
          />
        </LabeledField>
        <LabeledField>
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <Input
            id="confirmPassword"
            type={passwordType}
            name="confirmPassword"
            autoComplete="new-password"
            required
          />
        </LabeledField>
        <label className="flex items-center gap-icon text-body-sm">
          <Checkbox
            checked={showPassword}
            onChange={setShowPassword}
            aria-label="Show Password"
          />
          Show Password
        </label>
        <p className="text-sm text-fg-muted">{PASSWORD_POLICY_UI_COPY}</p>
        {error !== null ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="mt-2" disabled={setPassword.isPending || token.length === 0}>
          {setPassword.isPending ? "Saving…" : "Save Password"}
        </Button>
      </form>
      <p className="mt-6 text-sm text-fg-muted">
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
    <Suspense fallback={<p className="text-fg-muted">Loading…</p>}>
      <SetPasswordForm />
    </Suspense>
  );
}
