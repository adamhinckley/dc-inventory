"use client";

import Link from "next/link";
import { useWholesaleSignedIn } from "../lib/use-wholesale-signed-in";

export function HomeCta() {
  const signedIn = useWholesaleSignedIn();

  if (signedIn) {
    return (
      <Link href="/products" className="shop-button-primary inline-flex items-center">
        Browse Products
      </Link>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      <Link href="/login" className="shop-button-primary inline-flex items-center">
        Sign In
      </Link>
      <Link
        href="/register"
        className="shop-button-secondary inline-flex items-center"
      >
        Register
      </Link>
    </div>
  );
}
