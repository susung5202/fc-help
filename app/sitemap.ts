import type { MetadataRoute } from "next";

const siteUrl = "https://fchelp.xyz";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/players`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/refresh`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/squad`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/squad/maker`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/squad/gallery`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${siteUrl}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${siteUrl}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];
}
