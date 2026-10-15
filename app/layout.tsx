import type { Metadata } from "next";
import { PwaProvider } from "./pwa-install";
import "./globals.css";

export const metadata: Metadata = {
  title: "LST Ruta — logistika na jednom mestu",
  description: "Objavi turu, pronađi vozača i prati isporuku sa jedne platforme.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/icons/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sr">
      <head>
        <meta name="theme-color" content="#111216" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="LST Ruta" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="antialiased"><PwaProvider>{children}</PwaProvider></body>
    </html>
  );
}
