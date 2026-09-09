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
import { cartLineCount } from "../lib/active-cart";
import { openCartDrawer } from "../lib/cart-drawer-store";
import { company } from "../lib/company";
import { useActiveCart } from "../lib/use-active-cart";
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

function CartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 4h2l2.4 11.2a1.5 1.5 0 0 0 1.5 1.3h8.6a1.5 1.5 0 0 0 1.5-1.2L21 8H6.2M9 21a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm9 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
      />
    </svg>
  );
}

/** Header cart button: opens the drawer; badge is the active cart's line count. */
function HeaderCartButton() {
  const { activeDraft } = useActiveCart();
  const count = activeDraft === undefined ? 0 : cartLineCount(activeDraft);
  return (
    <button
      type="button"
      onClick={openCartDrawer}
      aria-label={count === 0 ? "Open cart" : `Open cart, ${count} ${count === 1 ? "item" : "items"}`}
      className="relative inline-flex size-10 cursor-pointer items-center justify-center rounded-full text-ink hover:bg-canvas"
    >
      <CartIcon />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[0.6875rem] font-semibold leading-5 text-on-accent">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
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
            className="h-10 w-auto max-w-56 object-contain sm:h-12 sm:max-w-72 lg:h-auto lg:w-[300px] lg:max-w-[300px]"
          />
        </Link>
        <div className="flex items-center gap-2">
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
          {signedIn ? <HeaderCartButton /> : null}
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
