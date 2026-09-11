"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState, Skeleton } from "@/components/ui/States";
import { useToast } from "@/components/ui/Toast";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProductForm } from "@/components/modules/ProductForm";
import { useAsync } from "@/lib/hooks";
import { allCategories } from "@/lib/db/categories";
import { allSuppliers } from "@/lib/db/suppliers";
import { createProduct, type ProductInput } from "@/lib/db/products";
import { errorMessage } from "@/lib/supabase";

export default function NewProductPage() {
  const router = useRouter();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  const lookups = useAsync(
    async () => ({ categories: await allCategories(), suppliers: await allSuppliers() }),
    [],
  );

  async function handleSubmit(input: ProductInput) {
    setSubmitting(true);
    try {
      const product = await createProduct(input);
      toast.success(`“${product.name}” created.`);
      router.push(`/products/${product.id}`);
    } catch (caught) {
      toast.error(errorMessage(caught));
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Add product"
        description="Products are the unit everything else hangs off — stock, ledger and reports."
        actions={
          <Link href="/products">
            <Button variant="secondary">Back to products</Button>
          </Link>
        }
      />

      <Card padded>
        {lookups.loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-16" />
            ))}
          </div>
        ) : lookups.error ? (
          <ErrorState message={lookups.error} onRetry={lookups.reload} />
        ) : (
          <ProductForm
            categories={lookups.data?.categories ?? []}
            suppliers={lookups.data?.suppliers ?? []}
            submitting={submitting}
            submitLabel="Create product"
            onSubmit={handleSubmit}
            onCancel={() => router.push("/products")}
          />
        )}
      </Card>
    </div>
  );
}
