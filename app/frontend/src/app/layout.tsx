import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "D&D Campaign Assistant",
  description: "Local-first campaign management system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="bg-stone-950 text-stone-100 antialiased">
        {children}
      </body>
    </html>
  );
}
