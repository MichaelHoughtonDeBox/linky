import type { Metadata } from "next";
import { Bricolage_Grotesque, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const linkyDisplay = Bricolage_Grotesque({
  variable: "--font-linky-display",
  subsets: ["latin"],
});

const linkyMono = IBM_Plex_Mono({
  variable: "--font-linky-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Linky - One short link for many tabs",
  description:
    "Create one short Linky URL that opens all your saved links from a single landing page.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${linkyDisplay.variable} ${linkyMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
