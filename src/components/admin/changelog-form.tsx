"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select-native";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

interface ChangelogFormProps {
  initialData?: any;
  isEditing?: boolean;
}

const typeOptions = [
  { value: "UPDATE", label: "Update" },
  { value: "FIX", label: "Fix" },
  { value: "INFO", label: "Info" },
  { value: "WARNING", label: "Warning" },
];

function toLocalInputDateTime(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ChangelogForm({ initialData, isEditing }: ChangelogFormProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);

  const [form, setForm] = useState({
    title: initialData?.title || "",
    body: initialData?.body || "",
    type: initialData?.type || "UPDATE",
    isDraft: initialData?.isDraft ?? true,
    publishedAt: toLocalInputDateTime(initialData?.publishedAt),
    productIds: initialData?.products?.map((p: any) => p.productId || p.product?.id) || [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/admin/products")
      .then((r) => r.json())
      .then((data) => {
        if (data.data) setProducts(data.data.map((p: any) => ({ id: p.id, name: p.name })));
      })
      .catch(console.error);
  }, []);

  const updateField = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const toggleProduct = (productId: string) => {
    setForm((prev) => ({
      ...prev,
      productIds: prev.productIds.includes(productId)
        ? prev.productIds.filter((id: string) => id !== productId)
        : [...prev.productIds, productId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const publishAtIso = form.isDraft
        ? null
        : (form.publishedAt ? new Date(form.publishedAt).toISOString() : new Date().toISOString());

      const body = {
        ...form,
        publishedAt: publishAtIso,
      };

      const url = isEditing
        ? `/api/admin/changelog/${initialData.id}`
        : "/api/admin/changelog";

      const res = await fetch(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errors) setErrors(data.errors);
        addToast({ type: "error", title: "Error", description: data.error || "Request failed" });
        return;
      }

      addToast({
        type: "success",
        title: isEditing ? "Updated" : "Created",
        description: isEditing ? "Changelog updated" : "Changelog created",
      });
      router.push("/admin/changelog");
      router.refresh();
    } catch (error) {
      addToast({ type: "error", title: "Error", description: "An unexpected error occurred" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle>Changelog Content</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input id="title" value={form.title} onChange={(e) => updateField("title", e.target.value)} placeholder="v2.4.0 - New Features" />
                {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">Body (Markdown) *</Label>
                <Textarea id="body" value={form.body} onChange={(e) => updateField("body", e.target.value)} placeholder="## Changes&#10;- Added new feature...&#10;- Fixed bug..." rows={12} className="font-mono text-sm" />
                {errors.body && <p className="text-sm text-destructive">{errors.body}</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Settings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select options={typeOptions} value={form.type} onChange={(e) => updateField("type", e.target.value)} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="isDraft">Draft</Label>
                <Switch id="isDraft" checked={form.isDraft} onCheckedChange={(v) => updateField("isDraft", v)} />
              </div>
              {!form.isDraft && (
                <div className="space-y-2">
                  <Label htmlFor="publishedAt">Publish At (optional)</Label>
                  <Input
                    id="publishedAt"
                    type="datetime-local"
                    value={form.publishedAt}
                    onChange={(e) => updateField("publishedAt", e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave empty to publish immediately. Choose a future date to schedule.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Related Products</CardTitle></CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <p className="text-sm text-muted-foreground">Loading...</p>
              ) : (
                <div className="space-y-2">
                  {products.map((product) => (
                    <label key={product.id} className="flex cursor-pointer items-center gap-2 rounded-md p-2 transition-colors hover:bg-muted">
                      <input
                        type="checkbox"
                        checked={form.productIds.includes(product.id)}
                        onChange={() => toggleProduct(product.id)}
                        className="rounded"
                      />
                      <span className="text-sm">{product.name}</span>
                    </label>
                  ))}
                </div>
              )}
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

