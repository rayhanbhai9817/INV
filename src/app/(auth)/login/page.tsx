"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { Logo } from "@/components/layout/Logo";
import { useAuth } from "@/components/providers/AuthProvider";
import { sendPasswordReset, signIn } from "@/lib/db/auth";
import { errorMessage } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading: sessionLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in — skip the form.
  useEffect(() => {
    if (!sessionLoading && user) router.replace("/dashboard");
  }, [user, sessionLoading, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Enter both your email and password.");
      return;
    }

    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      toast.success("Signed in.");
      router.replace("/dashboard");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReset() {
    if (!email.trim()) {
      setError("Enter your email address first, then choose “Forgot password”.");
      return;
    }
    try {
      await sendPasswordReset(email.trim());
      toast.success("Password reset email sent.");
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo height={52} className="mb-5" />
          <h1 className="text-xl font-semibold text-slate-900">Inventory Management</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to manage stock and reports.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@fastsold.com"
            required
          />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            required
          />

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" loading={submitting}>
            Sign in
          </Button>

          <button
            type="button"
            onClick={handleReset}
            className="w-full text-center text-xs text-slate-500 underline-offset-2 hover:text-brand-600 hover:underline"
          >
            Forgot password?
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">Internal system</p>
      </div>
    </main>
  );
}
