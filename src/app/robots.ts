import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      disallow: [
        "/dashboard",
        "/clients",
        "/monitored-records",
        "/work",
        "/recurring-tasks",
        "/calendar",
        "/reminders",
        "/reports",
        "/audit-history",
        "/settings",
        "/account",
        "/client",
        "/api",
        "/login",
        "/forgot-password",
        "/update-password",
      ],
    },
    sitemap: "https://deadlinemonitor.co.za/sitemap.xml",
    host: "https://deadlinemonitor.co.za",
  };
}
