import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Get Started",
  description:
    "Get started with Deadline Monitor, a business monitoring application for important records, dates and operational work.",
  alternates: { canonical: "/get-started" },
  openGraph: {
    title: "Get Started | Deadline Monitor",
    description:
      "Tell us about your business and monitored-record requirements.",
    url: "/get-started",
  },
};

export default function GetStartedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
