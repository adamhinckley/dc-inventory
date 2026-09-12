"use client";

import { useSetPasswordWholesale } from "@dc-inventory/api-client-wholesale";
import { PASSWORD_POLICY_UI_COPY } from "@dc-inventory/identity/password-policy";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { ShopPage } from "../../../components/shop-page";

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const setPassword = useSetPasswordWholesale();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (token.length === 0) {
      setError("This invite link is invalid or expired.");
      return;
    }
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    setError(null);
    setPassword.mutate(
      { data: { token, password } },
      {
        onSuccess: (response) => {
          if (response.status === 200) {
            router.push("/login");
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
            type="password"
            name="password"
            autoComplete="new-password"
            required
            className="shop-input"
          />
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
        <Link href="/login" className="font-medium text-accent hover:text-accent-hover">
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
