"use client";

import { useMemo, useState } from "react";
import { Inbox, Loader2, Pencil, Plus, X } from "lucide-react";

import { useToast } from "@/components/ui/Toast";
import { useAsync } from "@/lib/hooks";
import {
  allCategories,
  createCategory,
  deleteCategory,
  updateCategory,
} from "@/lib/db/categories";
import { allProducts } from "@/lib/db/products";
import { errorMessage } from "@/lib/supabase";
import { cn, formatNumber } from "@/lib/utils";
import type { Category } from "@/types";

export default function CategoriesPage() {
  const toast = useToast();
  const [reloadKey, setReloadKey] = useState(0);

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const [removing, setRemoving] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const taxonomy = useAsync(async () => {
    const [categories, products] = await Promise.all([allCategories(), allProducts()]);
    return { categories, products };
  }, [reloadKey]);

  const categories = taxonomy.data?.categories ?? [];

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    (taxonomy.data?.products ?? []).forEach((product) => {
      if (product.category_id) {
        map.set(product.category_id, (map.get(product.category_id) ?? 0) + 1);
      }
    });
    return map;
  }, [taxonomy.data]);

  function openCreate() {
    setEditingId(null);
    setName("");
    setOpen(true);
  }

  async function save() {
    if (!name.trim()) {
      toast.error("Category name is required");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateCategory(editingId, name.trim().slice(0, 120));
        toast.success("Category updated");
      } else {
        await createCategory(name.trim().slice(0, 120));
        toast.success("Category created");
      }
      setOpen(false);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!removing) return;
    setDeleting(true);
    try {
      await deleteCategory(removing.id);
      toast.success("Category deleted");
      setRemoving(null);
      setReloadKey((key) => key + 1);
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-6 rounded-[20px] border border-[#f4f7fe] bg-white p-6 shadow-sm md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#2b3674]">Taxonomy</h1>
          <p className="text-sm font-medium text-[#a3aed0]">
            Group products for faster filtering and clearer reporting.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openCreate}
            className="flex h-11 items-center rounded-2xl bg-[#4318ff] px-6 text-sm font-black uppercase tracking-widest text-white shadow-[0_10px_20px_-5px_rgba(67,24,255,0.3)] transition-all hover:bg-[#3311cc]"
          >
            <Plus className="mr-2 h-4 w-4" /> Add category
          </button>
        </div>
      </div>

      <div className="mb-8 overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-black/5">
        {taxonomy.loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-[#a3aed0]">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : taxonomy.error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-sm text-[#ee5d50]">
            <span>{taxonomy.error}</span>
            <button
              type="button"
              onClick={taxonomy.reload}
              className="rounded-xl border border-[#f4f7fe] px-4 py-2 text-xs font-bold text-[#2b3674] transition hover:bg-[#f4f7fe]"
            >
              Try again
            </button>
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-sm text-[#a3aed0]">
            <Inbox className="h-6 w-6" />
            No categories yet
          </div>
        ) : (
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#f4f7fe]">
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                  Name
                </th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                  Description
                </th>
                <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                  Products
                </th>
                <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map((category) => (
                <tr
                  key={category.id}
                  className="border-b border-[#f4f7fe] transition-colors hover:bg-[#f4f7fe]/30"
                >
                  <td className="px-6 py-4 font-bold text-[#2b3674]">{category.name}</td>
                  <td className="px-6 py-4 font-medium text-[#a3aed0]">—</td>
                  <td className="px-6 py-4 text-right font-black text-[#2b3674]">
                    {formatNumber(counts.get(category.id) ?? 0)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton
                        label="Edit category"
                        onClick={() => {
                          setEditingId(category.id);
                          setName(category.name);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        label="Delete category"
                        tone="danger"
                        onClick={() => setRemoving(category)}
                      >
                        <X className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <Overlay onClose={() => setOpen(false)}>
          <h2 className="text-lg font-black text-[#2b3674]">
            {editingId ? "Edit category" : "Add category"}
          </h2>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label
                htmlFor="cat-name"
                className="text-[10px] font-black uppercase tracking-[0.2em] text-[#a3aed0]"
              >
                Name
              </label>
              <input
                id="cat-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                autoFocus
                className="h-12 w-full rounded-2xl border border-[#f4f7fe] bg-[#f4f7fe] px-4 font-bold text-[#2b3674] outline-none focus:ring-2 focus:ring-[#4318ff]/20"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-11 rounded-2xl border border-[#f4f7fe] bg-white px-6 text-sm font-bold text-[#2b3674]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="h-11 rounded-2xl bg-[#4318ff] px-6 text-sm font-bold text-white transition hover:bg-[#3311cc] disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </Overlay>
      )}

      {removing && (
        <Overlay onClose={() => setRemoving(null)}>
          <h2 className="text-lg font-black text-[#2b3674]">Delete category</h2>
          <p className="py-4 text-sm text-[#a3aed0]">
            Delete <span className="font-bold text-[#2b3674]">{removing.name}</span>? This is
            blocked while products still use it.
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setRemoving(null)}
              className="h-11 rounded-2xl border border-[#f4f7fe] bg-white px-6 text-sm font-bold text-[#2b3674]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="h-11 rounded-2xl bg-[#ee5d50] px-6 text-sm font-bold text-white transition hover:bg-[#d94b3f] disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  tone = "default",
  children,
}: {
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg transition",
        tone === "danger"
          ? "text-[#ee5d50] hover:bg-[#ee5d50]/10"
          : "text-[#2b3674] hover:bg-[#f4f7fe]",
      )}
    >
      {children}
    </button>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[#0b1437]/40" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 w-full max-w-lg rounded-[20px] bg-white p-6 shadow-xl"
      >
        {children}
      </div>
    </div>
  );
}
