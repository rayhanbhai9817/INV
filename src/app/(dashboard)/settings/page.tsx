"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { changePassword } from "@/lib/db/auth";
import { saveSettings } from "@/lib/db/settings";
import { errorMessage } from "@/lib/supabase";

const CURRENCIES = ["USD", "EUR", "GBP", "NGN", "KES", "ZAR", "INR", "AED"];
const DATE_FORMATS = ["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"];

export default function SettingsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { settings, loading, refresh, applyLocal } = useSettings();

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");
  const [threshold, setThreshold] = useState("100");
  const [saving, setSaving] = useState(false);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    setName(settings.company_name);
    setCurrency(settings.currency);
    setDateFormat(settings.date_format);
    setThreshold(String(settings.low_stock_threshold));
  }, [settings]);

  async function handleSaveSettings() {
    setSaving(true);
    try {
      const next = {
        ...settings,
        company_name: name.trim().slice(0, 120),
        currency,
        date_format: dateFormat,
        low_stock_threshold: Math.max(0, Number(threshold) || 0),
      };
      const saved = await saveSettings(next);
      applyLocal(saved);
      await refresh();
      toast.success("Settings saved");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setUpdating(true);
    try {
      await changePassword(password);
      setPassword("");
      setConfirmPassword("");
      toast.success("Password updated");
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#a3aed0]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const labelClass = "ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]";
  const fieldClass =
    "h-11 w-full rounded-xl border border-[#f4f7fe] bg-[#f4f7fe] px-3 text-xs font-bold text-[#2b3674] outline-none focus:ring-2 focus:ring-[#4318ff]/20";

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-6 rounded-[20px] border border-[#f4f7fe] bg-white p-6 shadow-sm md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#2b3674]">Preferences</h1>
          <p className="text-sm font-medium text-[#a3aed0]">
            System configurations and your personal account credentials.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-black/5">
          <header className="border-b border-[#f4f7fe] px-6 pb-4 pt-6">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
              System Configuration
            </h2>
          </header>
          <div className="space-y-6 px-6 pb-6 pt-8">
            <div className="space-y-2">
              <label className={labelClass}>Inventory Identity</label>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                className={fieldClass}
              />
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Primary Currency</label>
              <select
                value={currency}
                onChange={(event) => setCurrency(event.target.value)}
                className={fieldClass}
              >
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Date Presentation</label>
              <select
                value={dateFormat}
                onChange={(event) => setDateFormat(event.target.value)}
                className={fieldClass}
              >
                {DATE_FORMATS.map((format) => (
                  <option key={format} value={format}>
                    {format}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className={labelClass}>Low Stock Threshold (Units)</label>
              <input
                type="number"
                min={0}
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
                className={fieldClass}
              />
              <p className="ml-1 text-[10px] font-bold text-[#a3aed0]">
                Global default units for product alerts
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={saving}
                className="h-11 w-full rounded-xl bg-[#4318ff] font-black uppercase tracking-widest text-white shadow-[0_10px_20px_-5px_rgba(67,24,255,0.3)] transition-all hover:bg-[#3311cc] disabled:opacity-60"
              >
                {saving ? "Processing…" : "Commit changes"}
              </button>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-black/5">
          <header className="border-b border-[#f4f7fe] px-6 pb-4 pt-6">
            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
              Account Credentials
            </h2>
          </header>
          <div className="space-y-6 px-6 pb-6 pt-8">
            <div className="space-y-4 rounded-2xl border border-[#f4f7fe] bg-[#f4f7fe] p-6">
              <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                Current Identity
              </label>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#2b3674] text-sm font-bold text-white shadow-lg">
                  {(user?.email ?? "U").charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="mb-1 text-sm font-bold leading-none text-[#2b3674]">
                    {settings.company_name}
                  </p>
                  <p className="text-[10px] font-bold text-[#a3aed0]">{user?.email ?? "—"}</p>
                </div>
              </div>
              <div className="mt-4 border-t border-white/50 pt-4">
                <span className="mr-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                  Assigned Access:
                </span>
                <span className="rounded-lg bg-[#05cd99]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#05cd99]">
                  admin
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <label className={labelClass}>Security Update</label>
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="New secure password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  maxLength={128}
                  autoComplete="new-password"
                  className={fieldClass}
                />
                <input
                  type="password"
                  placeholder="Confirm secure password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  maxLength={128}
                  autoComplete="new-password"
                  className={fieldClass}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleChangePassword}
              disabled={updating}
              className="h-11 w-full rounded-xl border border-[#f4f7fe] bg-white text-sm font-bold text-[#2b3674] shadow-sm transition hover:bg-[#f4f7fe] disabled:opacity-60"
            >
              {updating ? "Updating…" : "Update Security Code"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
