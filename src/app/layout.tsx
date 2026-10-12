import type { Metadata } from "next";
import { Cormorant_Garamond, Crimson_Text } from "next/font/google";
import "@/globals.css";
import "@uiw/react-md-editor/markdown-editor.css";

export const dynamic = "force-dynamic";

const cormorantGaramond = Cormorant_Garamond({
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-editorial-display",
  subsets: ["latin"],
  display: "swap",
});

const crimsonText = Crimson_Text({
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-editorial-body",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = (
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.BETTER_AUTH_URL ||
  "https://kraken.krishg.com"
).replace(/\/+$/, "");

const title = "Kraken — Your Regular Updates, Delivered";
const description =
  "Write regular updates to your friends. Daily, weekly, monthly, or custom — your choice when to publish.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    type: "website",
    siteName: "Kraken",
    url: "/",
    title,
    description,
    images: [{ url: "/apple-icon.png", alt: "Kraken" }],
  },
  twitter: {
    card: "summary",
    title,
    description,
    images: ["/apple-icon.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cormorantGaramond.variable} ${crimsonText.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
