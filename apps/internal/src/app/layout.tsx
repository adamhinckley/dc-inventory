import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-figtree",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DC Internal",
  description: "Staff dashboard — tables, reports, charts, and CRUD.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${figtree.variable} ${figtree.className}`}>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
