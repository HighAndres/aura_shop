import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

import { SiteHeader } from "@/components/site-header";
import { cn } from "@/lib/utils";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: {
    default: "Aura — belleza & cuidado personal",
    template: "%s · Aura",
  },
  description:
    "Marketplace de productos de belleza y cuidado personal. Envíos en México.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={cn(geistSans.variable)}>
      <body className="min-h-dvh font-sans antialiased">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
