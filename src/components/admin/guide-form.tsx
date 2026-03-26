"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

interface GuideFormProps {
  initialData?: any;
  isEditing?: boolean;
}

export function GuideForm({ initialData, isEditing }: GuideFormProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    title: initialData?.title || "",
    body: initialData?.body || "",
    productId: initialData?.productId || "",
    isDraft: initialData?.isDraft ?? true,
  });

  useEffect(() => {
    fetch("/api/admin/products")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          const list = (data.data || []).map((p: any) => ({ id: p.id, name: p.name }));
          setProducts(list);
          if (!form.productId && list[0]) {
            setForm((prev) => ({ ...prev, productId: list[0].id }));
          }
        }
      })
      .catch(() => {});
  }, []);

  const updateField = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});
    try {
      const res = await fetch(isEditing ? `/api/admin/guides/${initialData.id}` : "/api/admin/guides", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        addToast({ type: "error", title: "Error", description: data.error || "Could not save guide." });
        return;
      }

      addToast({ type: "success", title: isEditing ? "Updated" : "Created", description: "Guide saved." });
      router.push("/admin/guides");
      router.refresh();
    } catch {
      addToast({ type: "error", title: "Error", description: "Unexpected error." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Guide Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" value={form.title} onChange={(e) => updateField("title", e.target.value)} placeholder="How to use Product X safely" />
                {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Body (Markdown) *</Label>
                <Textarea
                  id="body"
                  rows={12}
                  className="font-mono text-sm"
                  value={form.body}
                  onChange={(e) => updateField("body", e.target.value)}
                  placeholder="## Installation steps..."
                />
                {errors.body && <p className="text-sm text-destructive">{errors.body}</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Product *</Label>
                <select
                  value={form.productId}
                  onChange={(e) => updateField("productId", e.target.value)}
                  className="h-10 w-full rounded-md border border-white/[0.12] bg-background px-3 text-sm outline-none"
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
                {errors.productId && <p className="text-sm text-destructive">{errors.productId}</p>}
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="isDraft">Draft</Label>
                <Switch id="isDraft" checked={form.isDraft} onCheckedChange={(value) => updateField("isDraft", value)} />
              </div>
              {!form.isDraft && <p className="text-xs text-muted-foreground">This guide will be visible to customers with this product.</p>}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" loading={loading}>
              {isEditing ? "Update" : "Create"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
