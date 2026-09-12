"use client";

import { useLoginInternal } from "@dc-inventory/api-client-internal";
import { Button, Input, Label, LabeledField } from "@dc-inventory/ui";
import { useState, type FormEvent } from "react";

type SignedInSession =
  | { audience: "staff" }
  | { audience: "platform" };

export function StaffSignInForm({
  defaultOrganizationSlug = "acme",
  defaultEmail = "",
  onSignedIn,
}: {
  defaultOrganizationSlug?: string;
  defaultEmail?: string;
  onSignedIn?: (session: SignedInSession) => void;
}) {
  const login = useLoginInternal();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const organizationSlugRaw = String(form.get("organizationSlug") ?? "").trim();
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    setError(null);
    login.mutate(
      {
        data: {
          ...(organizationSlugRaw.length > 0 ? { organizationSlug: organizationSlugRaw } : {}),
          email,
          password,
        },
      },
      {
        onSuccess: (result) => {
          if (result.status !== 200) {
            setError("Sign-in failed.");
            return;
          }
          onSignedIn?.({ audience: result.data.audience });
        },
        onError: () => {
          setError("Sign-in failed.");
        },
      },
    );
  }

  return (
    <form className="mt-8 flex flex-col gap-field-group" onSubmit={onSubmit}>
      <LabeledField>
        <Label htmlFor="organizationSlug">Organization (staff only)</Label>
        <Input
          id="organizationSlug"
          type="text"
          name="organizationSlug"
          autoComplete="organization"
          defaultValue={defaultOrganizationSlug}
          placeholder="acme"
        />
      </LabeledField>
      <LabeledField>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          name="email"
          autoComplete="username"
          defaultValue={defaultEmail}
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
