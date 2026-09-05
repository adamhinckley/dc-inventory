export function formatPostalAddress(parts: {
  line1: string;
  line2?: string | null;
  city: string;
  region: string;
  postal: string;
  country: string;
}): string[] {
  return [
    parts.line1,
    parts.line2 ?? undefined,
    `${parts.city}, ${parts.region} ${parts.postal}`,
    parts.country,
  ].filter((line): line is string => Boolean(line && line.length > 0));
}

export function formatPostalAddressInline(parts: {
  line1: string;
  line2?: string | null;
  city: string;
  region: string;
  postal: string;
  country: string;
}): string {
  return formatPostalAddress(parts).join(", ");
}
