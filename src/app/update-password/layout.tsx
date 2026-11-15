import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Update Password",
  description: "Set a new password for your Deadline Monitor account.",
  robots: { index: false, follow: false },
};

export default function UpdatePasswordLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
