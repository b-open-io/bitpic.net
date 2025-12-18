import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk, Spectral } from "next/font/google";
import "./globals.css";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { Providers } from "./providers";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const spectral = Spectral({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
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
        className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${spectral.variable} font-sans antialiased min-h-screen flex flex-col bg-background text-foreground`}
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
