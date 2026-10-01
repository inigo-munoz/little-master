import type { Metadata } from "next";
import { PRODUCT_NAME, PRODUCT_DESCRIPTION } from "@dnd/shared";
import { AppShell } from "../components/layout/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: PRODUCT_NAME,
  description: PRODUCT_DESCRIPTION,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-stone-950 text-stone-100 antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
