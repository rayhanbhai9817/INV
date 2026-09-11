"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/States";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { SupplierForm } from "@/components/modules/SupplierForm";
import { useAsync } from "@/lib/hooks";
import {
  createSupplier,
  deleteSupplier,
  listSuppliers,
  type SupplierInput,
} from "@/lib/db/suppliers";
import { DEFAULT_PAGE_SIZE } from "@/lib/db/helpers";
import { errorMessage } from "@/lib/supabase";
import type { Supplier } from "@/types";

export default function SuppliersPage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  const suppliers = useAsync(
    () => listSuppliers({ search, page, pageSize: DEFAULT_PAGE_SIZE }),
    [search, page],
  );

  async function handleCreate(input: SupplierInput) {
    setSaving(true);
    try {
      await createSupplier(input);
      toast.success("Supplier created.");
      setCreating(false);
      suppliers.reload();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteSupplier(pendingDelete.id);
      toast.success("Supplier deleted.");
      setPendingDelete(null);
      suppliers.reload();
    } catch (caught) {
      toast.error(errorMessage(caught));
    } finally {
      setDeleting(false);
    }
  }

  const rows = suppliers.data?.rows ?? [];

  return (
    <div>
      <PageHeader
        title="Suppliers"
        description="Your supplier directory — contact details for everyone you buy from."
        actions={<Button onClick={() => setCreating(true)}>Add supplier</Button>}
      />

      <Card>
        <div className="border-b border-slate-100 p-4">
          <SearchInput
            value={search}
            onChange={(value) => {
              setSearch(value);
              setPage(1);
            }}
            placeholder="Search name, phone or email…"
          />
        </div>

        {suppliers.loading ? (
          <TableSkeleton cols={5} />
        ) : suppliers.error ? (
          <ErrorState message={suppliers.error} onRetry={suppliers.reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No suppliers yet"
            message={search ? "No supplier matches your search." : "Add your first supplier."}
            action={
              <Button size="sm" onClick={() => setCreating(true)}>
                Add supplier
              </Button>
            }
          />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Supplier</TH>
                  <TH>Phone</TH>
                  <TH>Email</TH>
                  <TH>Address</TH>
                  <TH align="right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((supplier) => (
                  <TR key={supplier.id}>
                    <TD className="font-medium text-slate-900">
                      <Link href={`/suppliers/${supplier.id}`} className="hover:text-brand-600">
                        {supplier.name}
                      </Link>
                    </TD>
                    <TD className="text-sm">{supplier.phone ?? "—"}</TD>
                    <TD className="text-sm">{supplier.email ?? "—"}</TD>
                    <TD className="max-w-[18rem] truncate text-xs text-slate-500">
                      {supplier.address ?? "—"}
                    </TD>
                    <TD align="right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/suppliers/${supplier.id}`}>
                          <Button size="sm" variant="secondary">
                            Open
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => setPendingDelete(supplier)}
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
              pageSize={suppliers.data?.pageSize ?? DEFAULT_PAGE_SIZE}
              total={suppliers.data?.count ?? 0}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>

      <Modal open={creating} title="Add supplier" onClose={() => setCreating(false)}>
        <SupplierForm
          submitting={saving}
          submitLabel="Create supplier"
          onSubmit={handleCreate}
          onCancel={() => setCreating(false)}
        />
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete supplier"
        destructive
        loading={deleting}
        confirmLabel="Delete"
        message={
          <>
            Delete <strong>{pendingDelete?.name}</strong>? This is blocked while products are still
            linked to them.
          </>
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
