"use client";

import { useLoginInternal } from "@dc-inventory/api-client-internal";
import { Button, Input, Label } from "@dc-inventory/ui";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const DEV_STAFF_LOGIN =
  process.env.NODE_ENV === "development"
    ? { email: "staff@local.test", password: "phase1-staff-placeholder" }
    : undefined;

export default function LoginPage() {
  const router = useRouter();
  const login = useLoginInternal();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const organizationSlug = String(form.get("organizationSlug") ?? "");
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setError(null);
    login.mutate(
      { data: { organizationSlug, email, password } },
      {
        onSuccess: () => {
          router.push("/catalog");
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
        Staff sign-in. After <code>pnpm db:seed:phase1</code>, use organization{" "}
        <code>acme</code> with <code>staff@local.test</code>.
      </p>
      <form className="mt-8 flex flex-col gap-field-group" onSubmit={onSubmit}>
        <div className="flex flex-col gap-field">
          <Label htmlFor="organizationSlug">Organization</Label>
          <Input
            id="organizationSlug"
            type="text"
            name="organizationSlug"
            autoComplete="organization"
            placeholder="acme"
            defaultValue="acme"
            required
          />
        </div>
        <div className="flex flex-col gap-field">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            name="email"
            autoComplete="username"
            defaultValue={DEV_STAFF_LOGIN?.email}
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
            defaultValue={DEV_STAFF_LOGIN?.password}
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
