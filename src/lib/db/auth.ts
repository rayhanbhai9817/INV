"use client";

import { supabase, errorMessage } from "@/lib/supabase";
import type { Session, User } from "@supabase/supabase-js";

export async function signIn(email: string, password: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(errorMessage(error));
  if (!data.session) throw new Error("Sign-in did not return a session. Please try again.");
  return data.session;
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(errorMessage(error));
}

export async function getCurrentUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(errorMessage(error));
  return data.session?.user ?? null;
}

export async function sendPasswordReset(email: string): Promise<void> {
  const redirectTo =
    typeof window === "undefined" ? undefined : `${window.location.origin}/login`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw new Error(errorMessage(error));
}

/** Updates the signed-in operator's password. */
export async function changePassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(errorMessage(error));
}
