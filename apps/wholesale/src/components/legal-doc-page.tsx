import Link from "next/link";
import type { LegalCopy } from "../lib/legal-copy";
import { ShopPage } from "./shop-page";

export function LegalDocPage({ copy }: { copy: LegalCopy }) {
  return (
    <ShopPage>
      <article className="legal-copy mx-auto max-w-3xl">
        <p className="section-title">{copy.title}</p>
        <h1 className="page-title mt-2">{copy.title}</h1>
        {copy.body}
        <p className="mt-10 text-sm text-ink-muted">
          <Link href="/contact" className="text-accent hover:text-accent-hover">
            Contact us
          </Link>{" "}
          with questions.
        </p>
      </article>
    </ShopPage>
  );
}
