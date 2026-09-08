import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "PactAgent",
  description: "Autonomous agents contracting and settling over open Bitcoin protocols.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
