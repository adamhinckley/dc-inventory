"use client";

import { useState, type FormEvent } from "react";
import { company } from "../lib/company";

type RegisterPath = "new" | "existing" | null;

export function RegisterForm() {
  const [path, setPath] = useState<RegisterPath>(null);
  const [submitted, setSubmitted] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p className="text-ink-muted" role="status">
        Thank you. Customer service will enable web access. Call{" "}
        {company.phoneDisplay} or email {company.email}.
      </p>
    );
  }

  if (path === null) {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          className="shop-button-primary"
          onClick={() => setPath("new")}
        >
          Brand New Customer
        </button>
        <button
          type="button"
          className="shop-button-secondary"
          onClick={() => setPath("existing")}
        >
          Register Existing Account
        </button>
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <p className="text-sm text-ink-muted">
        {path === "new"
          ? "Tell us about your business. We do not create shop logins from this form — customer service enables web access."
          : "If you already buy from us, we will match this request to your account. Customer service enables web access."}
      </p>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Company name</span>
        <input name="company" required className="shop-input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Email Address</span>
        <input name="email" type="email" required className="shop-input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Phone</span>
        <input name="phone" type="tel" required className="shop-input" />
      </label>
      <button type="submit" className="shop-button-primary">
        Request Access
      </button>
      <button
        type="button"
        className="text-sm text-ink-muted hover:text-ink"
        onClick={() => setPath(null)}
      >
        Back
      </button>
    </form>
  );
}
