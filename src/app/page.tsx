"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";

/** Entry point: sends the visitor to the dashboard or to login. */
export default function RootPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [user, loading, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b1437]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/70 border-t-transparent" />
    </main>
  );
}
