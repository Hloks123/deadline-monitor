import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Deadline Monitor",
    short_name: "Deadline Monitor",
    description: "Know what's due. Before it's overdue.",
    start_url: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    icons: [
      {
        src: "/deadline-monitor-logo.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
