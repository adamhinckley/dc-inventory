"use client";

import { Button, Input, Label } from "@dc-inventory/ui";
import type { FormEvent } from "react";

export default function LoginPage() {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  return (
    <section className="section-flat w-full max-w-md p-panel">
      <h1 className="page-title">Sign in</h1>
      <p className="page-description mt-2">
        Placeholder staff login. Session binding lands with Identity.
      </p>
      <form className="mt-8 flex flex-col gap-field-group" onSubmit={onSubmit}>
        <div className="flex flex-col gap-field">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            name="email"
            autoComplete="username"
          />
        </div>
        <div className="flex flex-col gap-field">
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
