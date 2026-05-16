import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Providers } from "@/components/providers";
import { StructuredData } from "@/components/structured-data";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "KandangKu - POS & Manajemen Inventaris Ayam Hidup",
  description: "Aplikasi Point of Sale dan manajemen inventaris khusus untuk penjualan ayam hidup. Multi-kasir, stok real-time, pre-order, dan analytics lengkap.",
  keywords: ["POS", "Point of Sale", "Inventaris", "Ayam", "Manajemen Stok", "Kasir", "Penjualan"],
  authors: [{ name: "KandangKu" }],
  creator: "KandangKu",
  publisher: "KandangKu",
  formatDetection: {
    email: false,
    telephone: false,
    address: false,
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "id_ID",
    url: "https://kandangku.alfan-dev.online",
    siteName: "KandangKu",
    title: "KandangKu - POS & Manajemen Inventaris Ayam Hidup",
    description: "Aplikasi Point of Sale dan manajemen inventaris khusus untuk penjualan ayam hidup. Multi-kasir, stok real-time, pre-order, dan analytics lengkap.",
    images: [
      {
        url: "https://kandangku.alfan-dev.online/og-image.png",
        width: 1200,
        height: 630,
        alt: "KandangKu - POS & Manajemen Inventaris Ayam",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KandangKu - POS & Manajemen Inventaris Ayam Hidup",
    description: "Aplikasi Point of Sale dan manajemen inventaris khusus untuk penjualan ayam hidup.",
    images: ["https://kandangku.alfan-dev.online/og-image.png"],
  },
  alternates: {
    canonical: "https://kandangku.alfan-dev.online",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <meta name="theme-color" content="#0f172a" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="KandangKu" />
        <link rel="icon" href="/favicon.ico" sizes="32x32" type="image/x-icon" />
        <link rel="icon" href="/icon-192.png" sizes="192x192" type="image/png" />
        <link rel="icon" href="/icon-512.png" sizes="512x512" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={inter.className}>
        <GoogleAnalytics gaId="G-QC9NS7DZ69" />
        <StructuredData />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
