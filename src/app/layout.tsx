import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://deadlinemonitor.co.za"),
  title: {
    default: "Deadline Monitor | Know what's due. Before it's overdue.",
    template: "%s | Deadline Monitor",
  },
  description:
    "A South African business deadline and operational monitoring service for company-record metadata, renewals, recurring tasks, reminders, responsible contacts and reporting.",
  applicationName: "Deadline Monitor",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "en_ZA",
    siteName: "Deadline Monitor",
    title: "Deadline Monitor | Know what's due. Before it's overdue.",
    description:
      "Monitor business record metadata, renewal dates and operational work in one organised workspace.",
    url: "/",
    images: [
      {
        url: "/deadline-monitor-logo.png",
        width: 512,
        height: 512,
        alt: "Deadline Monitor",
      },
    ],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/deadline-monitor-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}