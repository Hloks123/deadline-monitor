"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton({ onNavigate }: { onNavigate?: () => void }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function signOut() {
    setPending(true);
    setError("");

    try {
      const { error: signOutError } = await createClient().auth.signOut();
      if (signOutError) {
        setError("We could not sign you out. Please try again.");
        return;
      }

      onNavigate?.();
      router.replace("/login");
      router.refresh();
    } catch {
      setError("We could not sign you out. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={signOut}
        disabled={pending}
        className="mt-2 flex min-h-[36px] w-full cursor-pointer items-center text-left text-sm font-semibold text-teal-400 hover:text-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
    </div>
  );
}
