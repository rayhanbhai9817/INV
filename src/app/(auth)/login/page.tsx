"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Logo } from "@/components/layout/Logo";
import { useAuth } from "@/components/providers/AuthProvider";
import { signIn } from "@/lib/db/auth";
import { errorMessage } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  // Already signed in — skip the form.
  useEffect(() => {
    if (!sessionLoading && user) router.replace("/dashboard");
  }, [user, sessionLoading, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const nextFieldErrors: { email?: string; password?: string } = {};
    if (!email.trim()) nextFieldErrors.email = "Email is required.";
    if (!password) nextFieldErrors.password = "Password is required.";
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) return;

    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/dashboard");
    } catch (caught) {
      setError(errorMessage(caught));
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-[420px]">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-xl shadow-slate-200/60 sm:p-10">
          {/* ----------------------------- Brand ---------------------------- */}
          <div className="mb-8">
            <Logo height={38} />
            <p className="mt-4 text-sm font-bold tracking-tight text-slate-900">Ozipco</p>
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-[2rem]">
            Welcome Back
          </h1>
          <p className="mt-2 text-sm text-slate-500">Sign in to your inventory dashboard</p>

          {/* ----------------------------- Form ----------------------------- */}
          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@ozipco.com"
                aria-invalid={Boolean(fieldErrors.email)}
                className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
                  fieldErrors.email
                    ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                    : "border-slate-200 focus:border-brand-500 focus:ring-brand-100"
                }`}
              />
              {fieldErrors.email && (
                <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-semibold text-slate-700"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  aria-invalid={Boolean(fieldErrors.password)}
                  className={`w-full rounded-xl border bg-white px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-4 ${
                    fieldErrors.password
                      ? "border-red-300 focus:border-red-400 focus:ring-red-100"
                      : "border-slate-200 focus:border-brand-500 focus:ring-brand-100"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1.5 text-xs font-medium text-red-600">{fieldErrors.password}</p>
              )}
            </div>

            {error && (
              <p className="text-sm font-medium text-red-600" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting && <Loader2 size={16} className="animate-spin" />}
              {submitting ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
