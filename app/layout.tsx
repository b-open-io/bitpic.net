import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "@/components/wallet-provider";

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
  description: "Store your avatar on the Bitcoin blockchain with bitpic. Immutable, permanent, and yours forever.",
  keywords: ["bitcoin", "avatar", "blockchain", "paymail", "bsv"],
  authors: [{ name: "bitpic.net" }],
  openGraph: {
    title: "bitpic.net - Your avatar on bitcoin, forever",
    description: "Store your avatar on the Bitcoin blockchain with bitpic.",
    type: "website",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
