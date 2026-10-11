import type { MetadataRoute } from "next";

const siteUrl = "https://fchelp.xyz";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${siteUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/players`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/refresh`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/community`, changeFrequency: "daily", priority: 0.7 },
    { url: `${siteUrl}/squad`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/squad/maker`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/squad/gallery`, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/guide`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/contact`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/privacy`, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/terms`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
