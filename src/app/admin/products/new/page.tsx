"use client";

import { Topbar } from "@/components/admin/topbar";
import { ProductForm } from "@/components/admin/product-form";

export default function NewProductPage() {
  return (
    <div>
      <Topbar title="New Product" description="Create a new product" />
      <ProductForm />
    </div>
  );
}
