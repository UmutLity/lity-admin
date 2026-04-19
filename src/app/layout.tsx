import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const manrope = Manrope({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lity Admin - Management Panel",
  description: "Lity Software Admin Panel - Product, Changelog & Site Management",
  icons: {
    icon: "/litysoftware.png",
    shortcut: "/litysoftware.png",
    apple: "/litysoftware.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={manrope.className}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
