"use client";

import type { FormEvent } from "react";

export default function LoginPage() {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <section className="w-full max-w-md rounded-2xl border border-line bg-card p-8 shadow-sm">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign in</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Placeholder wholesale-client login. Session binding lands with Identity.
      </p>
      <form className="mt-8 flex flex-col gap-4" onSubmit={onSubmit}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Email</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            className="rounded-lg border border-line bg-canvas px-3 py-2 text-ink"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink">Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            className="rounded-lg border border-line bg-canvas px-3 py-2 text-ink"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded-full bg-accent px-4 py-2 font-medium text-on-accent hover:bg-accent-hover"
        >
          Continue
        </button>
      </form>
    </section>
  );
}
