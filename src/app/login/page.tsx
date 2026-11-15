import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to your Deadline Monitor account.",
  alternates: { canonical: "/login" },
  robots: { index: false, follow: false },
};

const errorMessages: Record<string, string> = {
  inactive: "Your account is inactive.",
  "no-access":
    "Your account does not currently have access to an organisation. Contact consultant1@compimento.co.za.",
  "auth-unavailable":
    "We could not verify your account access. Please try again.",
  "reset-link-invalid":
    "This password-reset link is invalid or has expired. Request a new link.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <LoginForm initialError={error ? errorMessages[error] : undefined} />;
}
