"use client";

import { useLoginInternal } from "@dc-inventory/api-client-internal";
import { Button, Input, Label } from "@dc-inventory/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const router = useRouter();
  const login = useLoginInternal();
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
          router.push("/purchasing");
        },
        onError: () => {
          setError("Sign-in failed.");
        },
      },
    );
  }

  return (
    <section className="section-flat w-full max-w-md p-panel">
      <h1 className="page-title">Sign in</h1>
      <p className="page-description mt-2">
        Staff sign-in. After <code>pnpm db:seed:phase1</code>, use{" "}
        <code>staff@local.test</code>. You land on Purchasing so you can create
        a draft PO.
      </p>
      <form className="mt-8 flex flex-col gap-field-group" onSubmit={onSubmit}>
        <div className="flex flex-col gap-field">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            name="email"
            autoComplete="username"
            required
          />
        </div>
        <div className="flex flex-col gap-field">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            name="password"
            autoComplete="current-password"
            required
          />
        </div>
        {error !== null ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="mt-2" disabled={login.isPending}>
          Continue
        </Button>
      </form>
    </section>
  );
}
