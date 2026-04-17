import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aegis-12 | Zero-Knowledge Agent Security",
  description: "Frictionless AI transaction execution mapped to AMD SEV Enclaves",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
