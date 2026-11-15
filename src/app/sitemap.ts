import type { MetadataRoute } from "next";

const publicPages = ["", "/get-started", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPages.map((path) => ({
    url: `https://deadlinemonitor.co.za${path}`,
  }));
}
