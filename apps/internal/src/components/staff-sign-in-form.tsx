"use client";

import { useLoginInternal } from "@dc-inventory/api-client-internal";
import { Button, Input, Label, LabeledField } from "@dc-inventory/ui";
import { useState, type FormEvent } from "react";

export function StaffSignInForm({ onSignedIn }: { onSignedIn?: () => void }) {
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
          onSignedIn?.();
        },
        onError: () => {
          setError("Sign-in failed.");
        },
      },
    );
  }

  return (
    <form className="flex flex-col gap-field-group" onSubmit={onSubmit}>
      <LabeledField>
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
      </LabeledField>
      <LabeledField>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          name="email"
          autoComplete="username"
          required
        />
      </LabeledField>
      <LabeledField>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          name="password"
          autoComplete="current-password"
          required
        />
      </LabeledField>
      {error !== null ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="mt-2" disabled={login.isPending}>
        {login.isPending ? "Signing In…" : "Continue"}
      </Button>
    </form>
  );
}
