export const company = {
  name: "David Christopher's Collection",
  shortName: "David Christopher's",
  about:
    "David Christopher's Collection is a family owned and operated import/wholesale business located in Sheffield, Alabama. Our products are designed and selected with quality, functionality, and affordability in mind. Our team strives to provide excellent customer service and build lasting relationships.",
  street: "103 S Atlanta Ave",
  cityLine: "Sheffield, Alabama, 35660",
  email: "info@davidchristophers.com",
  phoneDisplay: "1-256-389-9424",
  phoneTel: "+12563899424",
  faxDisplay: "1-256-389-9379",
  social: [
    {
      label: "Instagram",
      href: "https://www.instagram.com/david_christophers_inc/",
    },
    {
      label: "Facebook",
      href: "https://www.facebook.com/davidchristophers.store/",
    },
    {
      label: "Pinterest",
      href: "https://www.pinterest.com/dchristophers/",
    },
    {
      label: "Faire",
      href: "https://davidchristophers.faire.com/",
    },
  ],
} as const;

export const legalDocs = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/payment-terms", label: "Payment Terms" },
  { href: "/claim-information", label: "Claim Information" },
] as const;
