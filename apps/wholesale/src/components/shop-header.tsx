import Link from "next/link";

const nav = [
  { href: "/products", label: "Products" },
  { href: "/orders", label: "Orders" },
  { href: "/cart", label: "Cart" },
  { href: "/checkout", label: "Checkout" },
] as const;

export function ShopHeader() {
  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href="/products" className="flex flex-col">
          <span className="text-xl font-semibold tracking-tight text-ink">
            DC Wholesale
          </span>
          <span className="text-sm text-ink-muted">
            Order for your account
          </span>
        </Link>
        <nav aria-label="Shop" className="flex flex-wrap items-center gap-5 text-sm">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-ink hover:text-accent"
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/login"
            className="rounded-full bg-accent px-4 py-2 font-medium text-on-accent hover:bg-accent-hover"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
