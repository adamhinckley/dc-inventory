export type WholesaleSessionMode = "buyer" | "staff_acting";

export type ShopNavLink = {
  href: string;
  label: string;
};

const BASE_SIGNED_IN_NAV: ShopNavLink[] = [
  { href: "/products", label: "Products" },
  { href: "/orders", label: "Orders" },
  { href: "/cart", label: "Cart" },
];

const ACCOUNT_NAV_LINK: ShopNavLink = { href: "/account", label: "Account" };

export function showsAccountNav(mode: WholesaleSessionMode): boolean {
  return mode === "buyer";
}

export function showsStaffActingAccountCard(mode: WholesaleSessionMode): boolean {
  return mode === "staff_acting";
}

export function signedInNavLinks(mode: WholesaleSessionMode): ShopNavLink[] {
  if (!showsAccountNav(mode)) {
    return BASE_SIGNED_IN_NAV;
  }
  return [...BASE_SIGNED_IN_NAV, ACCOUNT_NAV_LINK];
}

export function staffActingAccountDashboardHref(
  internalAppUrl: string,
  customerId: string | null,
): string {
  const base = internalAppUrl.replace(/\/$/, "");
  if (customerId !== null) {
    return `${base}/customers/${customerId}`;
  }
  return `${base}/customers`;
}

export function isExemptionCertificateExpired(
  expiresAt: string | null,
  now: Date = new Date(),
): boolean {
  if (expiresAt === null) {
    return false;
  }
  return new Date(expiresAt).getTime() < now.getTime();
}

export function exemptionCertificateFilename(objectKey: string | null): string | null {
  if (objectKey === null || objectKey.trim() === "") {
    return null;
  }
  const segments = objectKey.split("/");
  const filename = segments.at(-1);
  return filename === undefined || filename === "" ? objectKey : filename;
}
