import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Minmo Maker",
  description: "Balanced & Profitable Lightning Swap Making",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
