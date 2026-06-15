import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Avatar image endpoints and backend-proxied APIs aren't useful to crawl.
      disallow: ["/u/", "/api/"],
    },
    sitemap: "https://bitpic.net/sitemap.xml",
    host: "https://bitpic.net",
  };
}
