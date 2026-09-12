"use client";

import {
  getGetWholesaleSessionQueryKey,
  useLoginWholesale,
} from "@dc-inventory/api-client-wholesale";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { company } from "../lib/company";
import { onboardingPrefillFromSearchParams } from "../lib/onboarding-login";
import { postLoginPath } from "../lib/post-login-path";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const category = searchParams.get("category");
  const prefill = onboardingPrefillFromSearchParams(searchParams);
  const organizationSlug = prefill.organization.length > 0 ? prefill.organization : "acme";
  const queryClient = useQueryClient();
  const login = useLoginWholesale();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [forgot, setForgot] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setError(null);
    login.mutate(
      { data: { organizationSlug, email, password } },
      {
        onSuccess: async (response) => {
          await queryClient.invalidateQueries({
            queryKey: getGetWholesaleSessionQueryKey(),
          });
          if (response.status === 200) {
            router.push(postLoginPath(response.data, { category }));
          } else {
            router.push(postLoginPath({ mode: "buyer", customerId: null }, { category }));
          }
        },
        onError: () => {
          setError("Sign-in failed.");
        },
      },
    );
  }

  return (
    <section className="mx-auto max-w-md rounded-2xl border border-line bg-card p-8 shadow-sm">
      <p className="section-title">Account</p>
      <h1 className="page-title mt-2">Sign in</h1>
      {forgot ? (
        <div className="mt-6 text-ink-muted">
          <p>
            Password reset is not on the shop API. Contact customer service at{" "}
            {company.phoneDisplay} or {company.email}.
          </p>
          <button
            type="button"
            className="mt-6 text-sm font-medium text-accent hover:text-accent-hover"
            onClick={() => setForgot(false)}
          >
            Back to Sign In
          </button>
        </div>
      ) : (
        <>
          <form className="mt-8 flex flex-col gap-4" onSubmit={onSubmit}>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">Email</span>
              <input
                type="email"
                name="email"
                autoComplete="username"
                defaultValue={prefill.email}
                required
                className="shop-input"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">Password</span>
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                required
                className="shop-input"
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <label className="flex items-center gap-2 text-ink-muted">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(event) => setShowPassword(event.target.checked)}
                />
                Show Password
              </label>
              <button
                type="button"
                className="text-accent hover:text-accent-hover"
                onClick={() => setForgot(true)}
              >
                Forgot Password
              </button>
            </div>
            {error !== null ? (
              <p className="text-sold-out" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={login.isPending}
              className="shop-button-primary"
            >
              Continue
            </button>
          </form>
          <p className="mt-6 text-sm text-ink-muted">
            Need an account?{" "}
            <Link href="/register" className="font-medium text-accent hover:text-accent-hover">
              Register
            </Link>
          </p>
        </>
      )}
    </section>
  );
}
