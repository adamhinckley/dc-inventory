"use client";

import {
  getGetWholesaleSessionQueryKey,
  useLogoutWholesale,
} from "@dc-inventory/api-client-wholesale";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { company } from "../lib/company";
import { useWholesaleSignedIn } from "../lib/use-wholesale-signed-in";

const publicNav = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/register", label: "Register" },
  { href: "/login", label: "Sign in" },
] as const;

const signedInNav = [
  { href: "/products", label: "Products" },
  { href: "/orders", label: "Orders" },
  { href: "/cart", label: "Cart" },
] as const;

function navIsCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ShopHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const signedIn = useWholesaleSignedIn();
  const logout = useLogoutWholesale();
  const [menuOpen, setMenuOpen] = useState(false);

  const homeHref = signedIn ? "/products" : "/";
  const links = signedIn ? signedInNav : publicNav;

  function signOut() {
    logout.mutate(undefined, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: getGetWholesaleSessionQueryKey(),
        });
        setMenuOpen(false);
        router.push("/");
      },
    });
  }

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-card">
      <div className="mx-auto flex min-h-[var(--space-nav-height)] max-w-[var(--max-width-content)] items-center justify-between gap-4 px-6">
        <Link href={homeHref} className="flex min-w-0 items-center py-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo.png"
            alt={company.name}
            className="h-10 w-auto max-w-56 object-contain sm:h-12 sm:max-w-72"
          />
        </Link>
        <nav aria-label="Shop" className="hidden items-center gap-6 md:flex">
          {links.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="shop-nav-link"
              aria-current={navIsCurrent(pathname, item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
          {signedIn ? (
            <button
              type="button"
              className="shop-nav-link"
              onClick={signOut}
              disabled={logout.isPending}
            >
              Sign out
            </button>
          ) : null}
        </nav>
        <button
          type="button"
          className="shop-nav-link cursor-pointer rounded-lg border border-line px-3 py-2 md:hidden"
          aria-expanded={menuOpen}
          aria-controls="shop-mobile-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          Menu
        </button>
      </div>
      {menuOpen ? (
        <nav
          id="shop-mobile-nav"
          aria-label="Shop"
          className="border-t border-line bg-overlay px-6 py-4 md:hidden"
        >
          <ul className="flex flex-col gap-4">
            {links.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="shop-nav-link"
                  aria-current={
                    navIsCurrent(pathname, item.href) ? "page" : undefined
                  }
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                </Link>
              </li>
            ))}
            {signedIn ? (
              <li>
                <button type="button" className="shop-nav-link" onClick={signOut}>
                  Sign out
                </button>
              </li>
            ) : null}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
