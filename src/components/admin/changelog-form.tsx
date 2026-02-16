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
      const body = {
        ...form,
        publishedAt: form.isDraft ? null : new Date().toISOString(),
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
        addToast({ type: "error", title: "Hata", description: data.error || "İşlem başarısız" });
        return;
      }

      addToast({
        type: "success",
        title: isEditing ? "Güncellendi" : "Oluşturuldu",
        description: `Changelog ${isEditing ? "güncellendi" : "oluşturuldu"}`,
      });
      router.push("/admin/changelog");
      router.refresh();
    } catch (error) {
      addToast({ type: "error", title: "Hata", description: "Bir hata oluştu" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle>Changelog İçeriği</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Başlık *</Label>
                <Input id="title" value={form.title} onChange={(e) => updateField("title", e.target.value)} placeholder="v2.4.0 - New Features" />
                {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="body">İçerik (Markdown) *</Label>
                <Textarea id="body" value={form.body} onChange={(e) => updateField("body", e.target.value)} placeholder="## Changes&#10;- Added new feature...&#10;- Fixed bug..." rows={12} className="font-mono text-sm" />
                {errors.body && <p className="text-sm text-destructive">{errors.body}</p>}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Ayarlar</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tür</Label>
                <Select options={typeOptions} value={form.type} onChange={(e) => updateField("type", e.target.value)} />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="isDraft">Taslak</Label>
                <Switch id="isDraft" checked={form.isDraft} onCheckedChange={(v) => updateField("isDraft", v)} />
              </div>
              {!form.isDraft && (
                <p className="text-xs text-muted-foreground">Kaydedildiğinde hemen yayınlanacak.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>İlgili Ürünler</CardTitle></CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <p className="text-sm text-muted-foreground">Yükleniyor...</p>
              ) : (
                <div className="space-y-2">
                  {products.map((product) => (
                    <label key={product.id} className="flex items-center gap-2 cursor-pointer rounded-md p-2 hover:bg-muted transition-colors">
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
              {isEditing ? "Güncelle" : "Oluştur"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              İptal
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
