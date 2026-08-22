"use client";

import { Button, Input, Label } from "@dc-inventory/ui";
import type { FormEvent } from "react";

export default function LoginPage() {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <section className="w-full max-w-md rounded-sm border border-border-subtle bg-layer-02 p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-primary">
        Sign in
      </h1>
      <p className="mt-2 text-sm text-secondary">
        Placeholder staff login. Session binding lands with Identity.
      </p>
      <form className="mt-8 flex flex-col gap-4" onSubmit={onSubmit}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            name="email"
            autoComplete="username"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            name="password"
            autoComplete="current-password"
          />
        </div>
        <Button type="submit" className="mt-2">
          Continue
        </Button>
      </form>
    </section>
  );
}
