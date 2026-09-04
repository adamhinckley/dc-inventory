import Link from "next/link";
import { company, legalDocs } from "../lib/company";

export function ShopFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-canvas-muted">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/footer.jpg"
        alt=""
        className="h-44 w-full object-cover object-right sm:h-56"
      />
      <div className="px-6 py-8">
        <div className="shop-social-band">
          <p className="shop-social-band-title">Let's Be Friends</p>
          <ul className="mt-4 flex flex-wrap justify-center gap-x-6 gap-y-3">
            {company.social.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="shop-social-band-link"
                  rel="noreferrer"
                  target="_blank"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-auto mt-8 flex max-w-[var(--max-width-content)] flex-col gap-4 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {company.name}. All rights reserved.
          </p>
          <ul className="flex flex-wrap gap-4">
            {legalDocs.map((doc) => (
              <li key={doc.href}>
                <Link href={doc.href} className="hover:text-ink">
                  {doc.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
