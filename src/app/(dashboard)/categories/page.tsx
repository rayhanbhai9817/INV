"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { useAsync } from "@/lib/hooks";
import {
  createCategory,
  deleteCategory,
  listCategories,
  updateCategory,
} from "@/lib/db/categories";
import { DEFAULT_PAGE_SIZE } from "@/lib/db/helpers";
import { errorMessage } from "@/lib/supabase";
import { formatDate } from "@/lib/utils";
import type { Category } from "@/types";

export default function CategoriesPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [editing, setEditing] = useState<Category | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const categories = useAsync(
    () => listCategories({ search, page, pageSize: DEFAULT_PAGE_SIZE }),
    [search, page],
  );

  function openCreate() {
    setCreating(true);
    setEditing(null);
    setName("");
    setFormError(null);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setCreating(false);
    setName(category.name);
    setFormError(null);
  }

  function closeModal() {
    setCreating(false);
    setEditing(null);
    setFormError(null);
  }

  async function handleSave() {
    if (!name.trim()) {
      setFormError("Category name is required.");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateCategory(editing.id, name);
        toast.success("Category updated.");
      } else {
        await createCategory(name);
        toast.success("Category created.");
      }
      closeModal();
      categories.reload();
    } catch (caught) {
      setFormError(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteCategory(pendingDelete.id);
      toast.success("Category deleted.");
      setPendingDelete(null);
      categories.reload();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setDeleting(false);
    }
  }

  const rows = categories.data?.rows ?? [];

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Group products. A category in use by any product cannot be deleted."
        actions={<Button onClick={openCreate}>Add category</Button>}
      />

      <Card>
        <div className="border-b border-slate-100 p-4">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search categories…"
          />
        </div>

        {categories.loading ? (
          <TableSkeleton cols={3} />
        ) : categories.error ? (
          <ErrorState message={categories.error} onRetry={categories.reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No categories yet"
            message={search ? "No category matches your search." : "Create your first category."}
            action={
              <Button size="sm" onClick={openCreate}>
                Add category
              </Button>
            }
          />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Created</TH>
                  <TH align="right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((category) => (
                  <TR key={category.id}>
                    <TD className="font-medium text-slate-900">{category.name}</TD>
                    <TD className="text-xs text-slate-500">{formatDate(category.created_at)}</TD>
                    <TD align="right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openEdit(category)}>
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => setPendingDelete(category)}
                        >
                          Delete
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination
              page={page}
              pageSize={categories.data?.pageSize ?? DEFAULT_PAGE_SIZE}
              total={categories.data?.count ?? 0}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <Modal
        open={creating || Boolean(editing)}
        title={editing ? "Edit category" : "Add category"}
        onClose={closeModal}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editing ? "Save changes" : "Create"}
            </Button>
          </>
        }
      >
        <Input
          label="Category name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Stationery"
          error={formError}
          required
          autoFocus
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete category"
        destructive
        loading={deleting}
        confirmLabel="Delete"
        message={
          <>
            Delete <strong>{pendingDelete?.name}</strong>? This is blocked while products still use
            it.
          </>
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
