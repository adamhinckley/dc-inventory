"use client";

import { useLoginWholesale } from "@dc-inventory/api-client-wholesale";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const router = useRouter();
  const login = useLoginWholesale();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setError(null);
    login.mutate(
      { data: { email, password } },
      {
        onSuccess: () => {
          router.push("/products");
        },
        onError: () => {
          setError("Sign-in failed.");
        },
      },
    );
  }

  return (
    <section className="w-full max-w-md rounded-2xl border border-line bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Wholesale-client sign-in. After <code>pnpm db:seed:phase1</code>, use{" "}
        <code>wholesale@local.test</code>.
      </p>
      <form className="mt-8 flex flex-col gap-4" onSubmit={onSubmit}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            className="rounded-lg border border-line bg-canvas px-3 py-2 text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            className="rounded-lg border border-line bg-canvas px-3 py-2 text-ink"
          />
        </label>
        {error !== null ? (
          <p className="text-sold-out" role="alert">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={login.isPending}
          className="mt-2 rounded-full bg-accent px-4 py-2 font-medium text-on-accent hover:bg-accent-hover disabled:opacity-60"
        >
          Continue
        </button>
      </form>
    </section>
  );
}
