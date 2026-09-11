"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const MISSING_ENV_MESSAGE =
  "Missing Supabase environment variables. Copy .env.example to .env.local and set " +
  "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.";

/**
 * Next.js re-evaluates modules on fast refresh and prerenders pages at build
 * time, so the client is created lazily and parked on globalThis: exactly one
 * instance, one auth listener, and no crash during a build that has no env
 * vars in scope.
 */
const globalForSupabase = globalThis as typeof globalThis & {
  __fastsold_supabase__?: SupabaseClient;
};

function getClient(): SupabaseClient {
  if (globalForSupabase.__fastsold_supabase__) return globalForSupabase.__fastsold_supabase__;
  if (!supabaseUrl || !supabaseAnonKey) throw new Error(MISSING_ENV_MESSAGE);

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "fastsold-auth",
    },
  });

  globalForSupabase.__fastsold_supabase__ = client;
  return client;
}

/** Shared client. Every database call in `src/lib/db/` goes through this. */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, property, receiver) {
    const client = getClient();
    const value = Reflect.get(client, property, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

/** Normalises anything thrown by the Supabase client into a readable message. */
export function errorMessage(error: unknown): string {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  const maybe = error as { message?: string; error_description?: string };
  return maybe.message ?? maybe.error_description ?? "Unexpected error";
}
