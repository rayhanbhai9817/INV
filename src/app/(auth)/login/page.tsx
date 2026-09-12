"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";

import { useAuth } from "@/components/providers/AuthProvider";
import { signIn } from "@/lib/db/auth";
import { errorMessage } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in — skip the form.
  useEffect(() => {
    if (!sessionLoading && user) router.replace("/dashboard");
  }, [user, sessionLoading, router]);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }

    setBusy(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/dashboard");
    } catch (caught) {
      setError(errorMessage(caught));
      setBusy(false);
    }
  }

  const fieldClass =
    "h-14 w-full rounded-2xl border border-[#e0e5f2] bg-white px-5 text-base text-[#2b3674] outline-none transition placeholder:text-[#a3aed0] focus:border-[#4318ff] focus:ring-4 focus:ring-[#4318ff]/10";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b1437] px-5 py-12 selection:bg-[#4318ff]/30">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="mx-auto mb-8 flex h-[68px] w-[68px] items-center justify-center rounded-[22px] bg-white shadow-2xl">
            <ShieldCheck className="h-8 w-8 text-[#1b2559]" strokeWidth={2} />
          </div>

          <p className="mb-3 text-[11px] font-black uppercase tracking-[0.35em] text-[#707eae]">
            Ozipco Inventory
          </p>
          <h1 className="text-4xl font-black leading-none tracking-tight text-white sm:text-5xl">
            OZIPCO Inventory
          </h1>
          <p className="mt-4 text-base font-medium text-[#a3aed0]">
            Secure Inventory Management
          </p>
        </div>

        <div className="rounded-[24px] bg-white p-8 shadow-[0_18px_40px_rgba(0,0,0,0.25)]">
          <form onSubmit={handleSignIn} className="space-y-6" noValidate>
            <div className="space-y-2.5">
              <label
                htmlFor="email"
                className="ml-1 block text-[11px] font-black uppercase tracking-[0.2em] text-[#2b3674]"
              >
                Email / Username
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                maxLength={255}
                placeholder="mail@ozipco.com"
                className={fieldClass}
              />
            </div>

            <div className="space-y-2.5">
              <label
                htmlFor="password"
                className="ml-1 block text-[11px] font-black uppercase tracking-[0.2em] text-[#2b3674]"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  maxLength={128}
                  placeholder="Min. 8 characters"
                  className={`${fieldClass} pr-14`}
                />
                <button
                  type="button"
                  onClick={() => setShow((value) => !value)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#a3aed0] transition-colors hover:text-[#2b3674]"
                >
                  {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-[#ee5d50]/20 bg-[#ee5d50]/5 px-4 py-3 text-xs font-bold text-[#ee5d50]"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex h-14 w-full items-center justify-center rounded-2xl bg-[#4318ff] text-sm font-black uppercase tracking-[0.2em] text-white shadow-[0_14px_30px_-8px_rgba(67,24,255,0.6)] transition-all hover:bg-[#3311cc] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {busy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…
                </>
              ) : (
                <>Login &nbsp;→</>
              )}
            </button>
          </form>
        </div>

        <p className="mt-10 text-center text-[11px] font-black uppercase tracking-[0.25em] text-[#707eae]/70">
          Authorized Personnel Only
        </p>
      </div>
    </main>
  );
}
