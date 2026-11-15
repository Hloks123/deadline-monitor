import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Request a password reset for your Deadline Monitor account.",
  alternates: { canonical: "/forgot-password" },
  robots: { index: false, follow: false },
};

export default function ForgotPasswordLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
