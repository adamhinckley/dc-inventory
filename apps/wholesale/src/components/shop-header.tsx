"use client";

import {
  getGetWholesaleSessionQueryKey,
  useGetWholesaleSession,
  useLogoutWholesale,
} from "@dc-inventory/api-client-wholesale";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { signedInNavLinks } from "../lib/account-nav";
import { company } from "../lib/company";
import { useWholesaleSignedIn } from "../lib/use-wholesale-signed-in";

const publicNav = [
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/register", label: "Register" },
  { href: "/login", label: "Sign in" },
] as const;

function navIsCurrent(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ShopHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const signedIn = useWholesaleSignedIn();
  const session = useGetWholesaleSession({
    query: {
      queryKey: getGetWholesaleSessionQueryKey(),
      retry: false,
      enabled: signedIn,
    },
  });
  const logout = useLogoutWholesale();
  const [menuOpen, setMenuOpen] = useState(false);

  const homeHref = signedIn ? "/products" : "/";
  const sessionMode =
    session.data?.status === 200 ? session.data.data.mode : "buyer";
  const links = signedIn ? signedInNavLinks(sessionMode) : publicNav;

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
    <header className="border-b border-line bg-card">
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
          className="shop-menu-toggle md:hidden"
          aria-expanded={menuOpen}
          aria-controls="shop-mobile-nav"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="shop-menu-toggle-bar" />
          <span className="shop-menu-toggle-bar" />
          <span className="shop-menu-toggle-bar" />
        </button>
      </div>
      {menuOpen ? (
        <nav
          id="shop-mobile-nav"
          aria-label="Shop"
          className="absolute inset-x-0 top-full z-30 border-b border-line bg-overlay px-6 py-4 md:hidden"
        >
          <ul className="flex flex-col items-end gap-4 text-right">
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
                <button
                  type="button"
                  className="shop-nav-link"
                  onClick={signOut}
                  disabled={logout.isPending}
                >
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
