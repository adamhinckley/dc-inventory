"use client";

import { useState, type FormEvent } from "react";
import { company } from "../lib/company";

export function ContactFeedbackForm() {
  const [sent, setSent] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "");
    const email = String(form.get("email") ?? "");
    const message = String(form.get("message") ?? "");
    const subject = encodeURIComponent(`Wholesale feedback from ${name}`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\n${message}`,
    );
    window.location.href = `mailto:${company.email}?subject=${subject}&body=${body}`;
    setSent(true);
  }

  if (sent) {
    return (
      <p className="text-ink-muted" role="status">
        Your email app should open with a message to {company.email}. If it does
        not, write us at that address or call {company.phoneDisplay}.
      </p>
    );
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={onSubmit}>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Name</span>
        <input name="name" required className="shop-input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Email Address</span>
        <input name="email" type="email" required className="shop-input" />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-ink">Message</span>
        <textarea name="message" required rows={5} className="shop-input py-3" />
      </label>
      <button type="submit" className="shop-button-primary self-start">
        Submit Feedback
      </button>
    </form>
  );
}
