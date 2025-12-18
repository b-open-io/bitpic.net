import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "bitpic.net - Your avatar on bitcoin, forever",
  description:
    "Store your avatar on the Bitcoin blockchain with bitpic. Immutable, permanent, and yours forever.",
  keywords: ["bitcoin", "avatar", "blockchain", "paymail", "bsv"],
  authors: [{ name: "bitpic.net" }],
  icons: {
    icon: "/avatar.png",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "bitpic.net - Your avatar on bitcoin, forever",
    description: "Store your avatar on the Bitcoin blockchain with bitpic.",
    type: "website",
    images: ["/og-image.jpg"],
  },
  twitter: {
    card: "summary_large_image",
    title: "bitpic.net - Your avatar on bitcoin, forever",
    description: "Store your avatar on the Bitcoin blockchain with bitpic.",
    images: ["/og-image.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col bg-background text-foreground`}
      >
        <Providers>
          <Header />
          <main className="flex-1 w-full">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
