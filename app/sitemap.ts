import type { MetadataRoute } from "next";

const BASE = "https://bitpic.net";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes: Array<{ path: string; priority: number }> = [
    { path: "/", priority: 1 },
    { path: "/paymail", priority: 0.9 },
    { path: "/upload", priority: 0.8 },
    { path: "/feed", priority: 0.7 },
    { path: "/about", priority: 0.6 },
  ];

  return routes.map(({ path, priority }) => ({
    url: `${BASE}${path}`,
    changeFrequency: "weekly",
    priority,
  }));
}
