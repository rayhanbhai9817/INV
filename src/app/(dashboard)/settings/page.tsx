"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSettings } from "@/components/providers/SettingsProvider";
import { applyThresholdToProducts, saveSettings } from "@/lib/db/settings";
import { errorMessage } from "@/lib/supabase";
import type { AppSettings } from "@/types";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "BDT", "INR", "AED"];
const PAGE_SIZES = ["10", "25", "50", "100"];

export default function SettingsPage() {
  const toast = useToast();
  const { user } = useAuth();
  const { settings, loading, refresh, applyLocal } = useSettings();

  const [form, setForm] = useState<AppSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applyingThreshold, setApplyingThreshold] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);

  useEffect(() => setForm(settings), [settings]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!form.company_name.trim()) {
      setError("Company name is required.");
      return;
    }
    if (!Number.isInteger(form.low_stock_threshold) || form.low_stock_threshold < 0) {
      setError("Low-stock threshold must be a whole number of 0 or more.");
      return;
    }

    setSaving(true);
    try {
      const saved = await saveSettings({ ...form, company_name: form.company_name.trim() });
      applyLocal(saved);
      await refresh();
      toast.success("Settings saved.");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function handleApplyThreshold() {
    setApplyingThreshold(true);
    try {
      const updated = await applyThresholdToProducts(form.low_stock_threshold);
      toast.success(
        updated === 0
          ? "Every product already has its own minimum set."
          : `Applied to ${updated} product(s) that had no minimum.`,
      );
      setConfirmApply(false);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setApplyingThreshold(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Settings"
        description="Company details, stock thresholds and display preferences."
      />

      <Card>
        <CardHeader title="General" subtitle="Applied across the whole application" />
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <Input
            label="Company name"
            value={form.company_name}
            onChange={(event) => setForm({ ...form, company_name: event.target.value })}
            required
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Low-stock threshold"
              type="number"
              min={0}
              step={1}
              value={String(form.low_stock_threshold)}
              onChange={(event) =>
                setForm({ ...form, low_stock_threshold: Number(event.target.value) })
              }
              hint="Default minimum for products that do not set their own."
            />
            <Select
              label="Currency"
              value={form.currency}
              onChange={(event) => setForm({ ...form, currency: event.target.value })}
              options={CURRENCIES.map((code) => ({ value: code, label: code }))}
            />
            <Select
              label="Rows per page"
              value={String(form.rows_per_page)}
              onChange={(event) =>
                setForm({ ...form, rows_per_page: Number(event.target.value) })
              }
              options={PAGE_SIZES.map((size) => ({ value: size, label: `${size} rows` }))}
              hint="Preferred table page size."
            />
            <Select
              label="Date format"
              value={form.date_format}
              onChange={(event) => setForm({ ...form, date_format: event.target.value })}
              options={[
                { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
                { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
                { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
              ]}
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setConfirmApply(true)}>
              Apply threshold to products
            </Button>
            <Button type="submit" loading={saving}>
              Save settings
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Account" subtitle="Signed-in operator" />
        <dl className="divide-y divide-slate-100 text-sm">
          <div className="flex justify-between gap-4 px-5 py-3">
            <dt className="text-slate-500">Email</dt>
            <dd className="font-medium text-slate-900">{user?.email ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4 px-5 py-3">
            <dt className="text-slate-500">User ID</dt>
            <dd className="font-mono text-xs text-slate-600">{user?.id ?? "—"}</dd>
          </div>
        </dl>
      </Card>

      <ConfirmDialog
        open={confirmApply}
        title="Apply threshold"
        loading={applyingThreshold}
        confirmLabel="Apply"
        message={`Set the minimum stock of every product that currently has 0 to ${form.low_stock_threshold}?`}
        onCancel={() => setConfirmApply(false)}
        onConfirm={handleApplyThreshold}
      />
    </div>
  );
}
