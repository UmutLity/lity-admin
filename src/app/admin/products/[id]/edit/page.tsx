"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Topbar } from "@/components/admin/topbar";
import { ProductForm } from "@/components/admin/product-form";
import { useToast } from "@/components/ui/toast";

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [product, setProduct] = useState<any | null>(null);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/admin/products/${params.id}`, { credentials: "include" });
        const data = await res.json();
        if (!res.ok || !data?.success || !data?.data) {
          throw new Error(data?.error || "Failed to load product");
        }
        if (!active) return;
        setProduct(data.data);
      } catch (error: any) {
        if (!active) return;
        addToast({
          type: "error",
          title: "Error",
          description: error?.message || "Failed to load product",
        });
      } finally {
        if (active) setLoading(false);
      }
    };

    run();
    return () => {
      active = false;
    };
  }, [params.id, addToast]);

  return (
    <div>
      <Topbar title="Edit Product" description="Update product details and pricing" />
      {loading ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 text-sm text-zinc-400">Loading product...</div>
      ) : product ? (
        <ProductForm initialData={product} isEditing />
      ) : (
        <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-6 text-sm text-red-300">
          Product could not be loaded.
        </div>
      )}
    </div>
  );
}
