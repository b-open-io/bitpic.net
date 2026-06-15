import { Feed } from "@/components/feed";
import { Hero } from "@/components/hero";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "BitPic",
  url: "https://bitpic.net",
  applicationCategory: "UtilityApplication",
  operatingSystem: "Web",
  description:
    "Store your Paymail avatar permanently on the Bitcoin (BSV) blockchain — immutable, open, and interoperable.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function Home() {
  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Hero />
      <Feed />
    </>
  );
}
